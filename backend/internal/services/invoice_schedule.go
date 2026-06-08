package services

import (
	"context"
	"errors"
	"strings"
	"time"

	"facturamas-api/internal/domain"
)

type InvoiceScheduleService struct {
	repo           domain.InvoiceScheduleRepository
	profileService *ProfileService
	invoiceService *InvoiceService
}

func NewInvoiceScheduleService(repo domain.InvoiceScheduleRepository, profileService *ProfileService, invoiceService *InvoiceService) *InvoiceScheduleService {
	return &InvoiceScheduleService{
		repo:           repo,
		profileService: profileService,
		invoiceService: invoiceService,
	}
}

func (s *InvoiceScheduleService) CreateSchedule(ctx context.Context, profileID string, schedule *domain.InvoiceSchedule) error {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}

	if err := validateInvoiceSchedule(schedule); err != nil {
		return err
	}

	schedule.ProfileID = profile.ID.Hex()
	schedule.Active = true
	if schedule.Status == "" {
		schedule.Status = domain.InvoiceIssued
	}
	if schedule.BillingUnit == "" {
		schedule.BillingUnit = domain.BillingUnitHours
	}
	if schedule.Currency == "" {
		schedule.Currency = profile.DefaultCurrency
	}
	if schedule.NextRunDate.IsZero() {
		schedule.NextRunDate = schedule.StartDate
	}

	return s.repo.Create(ctx, schedule)
}

func (s *InvoiceScheduleService) ListSchedules(ctx context.Context, profileID string) ([]domain.InvoiceSchedule, error) {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return nil, err
	}
	if err := s.GenerateDueInvoices(ctx); err != nil {
		return nil, err
	}
	return s.repo.GetAll(ctx, profile.ID.Hex())
}

func (s *InvoiceScheduleService) GetSchedule(ctx context.Context, profileID string, id string) (*domain.InvoiceSchedule, error) {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, profile.ID.Hex(), id)
}

func (s *InvoiceScheduleService) UpdateSchedule(ctx context.Context, profileID string, id string, updates *domain.InvoiceSchedule) error {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}

	existing, err := s.repo.GetByID(ctx, profile.ID.Hex(), id)
	if err != nil {
		return err
	}

	if err := validateInvoiceSchedule(updates); err != nil {
		return err
	}

	existing.Name = strings.TrimSpace(updates.Name)
	existing.Client = updates.Client
	existing.BillingUnit = updates.BillingUnit
	existing.Lines = updates.Lines
	existing.Notes = updates.Notes
	existing.Currency = updates.Currency
	existing.Status = normalizeInvoiceStatus(updates.Status)
	existing.Frequency = updates.Frequency
	existing.Interval = updates.Interval
	existing.StartDate = updates.StartDate
	if !updates.NextRunDate.IsZero() {
		existing.NextRunDate = updates.NextRunDate
	}
	existing.EndDate = updates.EndDate
	existing.DueDays = updates.DueDays
	existing.Active = updates.Active
	existing.ProfileID = profile.ID.Hex()

	if existing.NextRunDate.IsZero() {
		existing.NextRunDate = existing.StartDate
	}

	return s.repo.Update(ctx, id, existing)
}

func (s *InvoiceScheduleService) DeleteSchedule(ctx context.Context, profileID string, id string) error {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}
	if _, err := s.repo.GetByID(ctx, profile.ID.Hex(), id); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}

func (s *InvoiceScheduleService) GenerateDueInvoicesForSchedule(ctx context.Context, profileID string, id string) (*domain.InvoiceSchedule, int, error) {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return nil, 0, err
	}

	schedule, err := s.repo.GetByID(ctx, profile.ID.Hex(), id)
	if err != nil {
		return nil, 0, err
	}

	generatedCount, err := s.generateDueInvoicesForSchedule(ctx, schedule, time.Now())
	if err != nil {
		return nil, 0, err
	}

	if err := s.repo.Update(ctx, schedule.ID.Hex(), schedule); err != nil {
		return nil, 0, err
	}

	return schedule, generatedCount, nil
}

func (s *InvoiceScheduleService) GenerateDueInvoices(ctx context.Context) error {
	now := time.Now()
	schedules, err := s.repo.GetDueSchedules(ctx, now)
	if err != nil {
		return err
	}

	for i := range schedules {
		schedule := schedules[i]

		if _, err := s.generateDueInvoicesForSchedule(ctx, &schedule, now); err != nil {
			return err
		}

		if err := s.repo.Update(ctx, schedule.ID.Hex(), &schedule); err != nil {
			return err
		}
	}

	return nil
}

func (s *InvoiceScheduleService) generateDueInvoicesForSchedule(ctx context.Context, schedule *domain.InvoiceSchedule, now time.Time) (int, error) {
	generatedCount := 0

	for !schedule.NextRunDate.IsZero() && !schedule.NextRunDate.After(now) && schedule.Active {
		if !schedule.EndDate.IsZero() && schedule.NextRunDate.After(schedule.EndDate) {
			schedule.Active = false
			break
		}

		invoice := &domain.Invoice{
			Client:      schedule.Client,
			BillingUnit: schedule.BillingUnit,
			Lines:       cloneScheduleLines(schedule.Lines),
			Notes:       schedule.Notes,
			Currency:    schedule.Currency,
			Status:      normalizeInvoiceStatus(schedule.Status),
			IssueDate:   schedule.NextRunDate,
		}
		if schedule.DueDays > 0 {
			invoice.DueDate = schedule.NextRunDate.AddDate(0, 0, schedule.DueDays)
		}

		if err := s.invoiceService.CreateInvoice(ctx, schedule.ProfileID, invoice); err != nil {
			return generatedCount, err
		}

		generatedCount++
		schedule.LastRunAt = time.Now()
		schedule.NextRunDate = advanceScheduleDate(schedule.NextRunDate, schedule.Frequency, schedule.Interval)
	}

	if !schedule.EndDate.IsZero() && !schedule.NextRunDate.IsZero() && schedule.NextRunDate.After(schedule.EndDate) {
		schedule.Active = false
	}

	return generatedCount, nil
}

func validateInvoiceSchedule(schedule *domain.InvoiceSchedule) error {
	if strings.TrimSpace(schedule.Name) == "" {
		return errors.New("schedule name is required")
	}
	if schedule.Client.Name == "" {
		return errors.New("client name is required")
	}
	if len(schedule.Lines) == 0 {
		return errors.New("at least one line is required")
	}
	if schedule.StartDate.IsZero() {
		return errors.New("start date is required")
	}
	if schedule.Interval <= 0 {
		return errors.New("interval must be greater than 0")
	}
	if schedule.Frequency != domain.InvoiceScheduleWeekly && schedule.Frequency != domain.InvoiceScheduleMonthly {
		return errors.New("frequency must be weekly or monthly")
	}
	if schedule.BillingUnit != domain.BillingUnitHours && schedule.BillingUnit != domain.BillingUnitDays && schedule.BillingUnit != domain.BillingUnitService {
		return errors.New("billing unit must be hours, days or service")
	}
	if schedule.DueDays < 0 {
		return errors.New("due days must be 0 or greater")
	}
	for i := range schedule.Lines {
		if schedule.Lines[i].Description == "" {
			return errors.New("line description is required")
		}
		if schedule.BillingUnit == domain.BillingUnitService {
			schedule.Lines[i].Quantity = 1
		}
		if schedule.Lines[i].Quantity <= 0 {
			return errors.New("line quantity must be greater than 0")
		}
		if schedule.Lines[i].UnitPrice < 0 {
			return errors.New("line unit price cannot be negative")
		}
	}
	return nil
}

func advanceScheduleDate(date time.Time, frequency domain.InvoiceScheduleFrequency, interval int) time.Time {
	if interval <= 0 {
		interval = 1
	}
	switch frequency {
	case domain.InvoiceScheduleWeekly:
		return date.AddDate(0, 0, 7*interval)
	default:
		return date.AddDate(0, interval, 0)
	}
}

func cloneScheduleLines(lines []domain.InvoiceLine) []domain.InvoiceLine {
	cloned := make([]domain.InvoiceLine, len(lines))
	copy(cloned, lines)
	return cloned
}
