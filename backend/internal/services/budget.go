package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"facturamas-api/internal/domain"
)

type BudgetService struct {
	budgetRepo     domain.BudgetRepository
	profileService *ProfileService
	invoiceService *InvoiceService
}

func NewBudgetService(budgetRepo domain.BudgetRepository, profileService *ProfileService, invoiceService *InvoiceService) *BudgetService {
	return &BudgetService{
		budgetRepo:     budgetRepo,
		profileService: profileService,
		invoiceService: invoiceService,
	}
}

func (s *BudgetService) CreateBudget(ctx context.Context, profileID string, budget *domain.Budget) error {
	if err := validateBudgetInput(budget); err != nil {
		return err
	}

	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}

	series := budgetSeries(profile.DefaultSeries)
	sequence, err := s.nextAvailableSequence(ctx, profile.ID.Hex(), series)
	if err != nil {
		return err
	}

	budget.ProfileID = profile.ID.Hex()
	budget.Series = series
	budget.Sequence = sequence
	budget.Number = fmt.Sprintf("%s-%05d", series, sequence)
	budget.Emitter = emitterDataFromProfile(profile)
	if budget.Currency == "" {
		budget.Currency = profile.DefaultCurrency
	}
	if budget.IssueDate.IsZero() {
		budget.IssueDate = time.Now()
	}
	if budget.Status == "" {
		budget.Status = domain.BudgetDraft
	}
	if budget.BillingUnit == "" {
		budget.BillingUnit = domain.BillingUnitHours
	}

	calculateTotalsFromLines(
		budget.Lines,
		&budget.Subtotal,
		&budget.VATAmount,
		&budget.WithholdingAmount,
		&budget.GrandTotal,
	)

	return s.budgetRepo.Create(ctx, budget)
}

func (s *BudgetService) GetBudget(ctx context.Context, profileID string, id string) (*domain.Budget, error) {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return nil, err
	}
	return s.budgetRepo.GetByID(ctx, profile.ID.Hex(), id)
}

func (s *BudgetService) ListBudgets(ctx context.Context, profileID string) ([]domain.Budget, error) {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return nil, err
	}
	return s.budgetRepo.GetAll(ctx, profile.ID.Hex())
}

func (s *BudgetService) UpdateBudget(ctx context.Context, profileID string, id string, updates *domain.Budget) error {
	if err := validateBudgetInput(updates); err != nil {
		return err
	}

	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}

	existing, err := s.budgetRepo.GetByID(ctx, profile.ID.Hex(), id)
	if err != nil {
		return err
	}

	existing.Client = updates.Client
	existing.Lines = updates.Lines
	existing.Notes = updates.Notes
	existing.Status = normalizeBudgetStatus(updates.Status)
	existing.IssueDate = updates.IssueDate
	existing.ValidUntil = updates.ValidUntil
	if updates.BillingUnit != "" {
		existing.BillingUnit = updates.BillingUnit
	}
	if updates.Currency != "" {
		existing.Currency = updates.Currency
	}
	existing.ProfileID = profile.ID.Hex()

	calculateTotalsFromLines(
		existing.Lines,
		&existing.Subtotal,
		&existing.VATAmount,
		&existing.WithholdingAmount,
		&existing.GrandTotal,
	)

	return s.budgetRepo.Update(ctx, id, existing)
}

func (s *BudgetService) DeleteBudget(ctx context.Context, profileID string, id string) error {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}
	if _, err := s.budgetRepo.GetByID(ctx, profile.ID.Hex(), id); err != nil {
		return err
	}
	return s.budgetRepo.Delete(ctx, id)
}

func (s *BudgetService) DuplicateBudget(ctx context.Context, profileID string, id string) (*domain.Budget, error) {
	original, err := s.GetBudget(ctx, profileID, id)
	if err != nil {
		return nil, err
	}

	newBudget := &domain.Budget{
		Client:      original.Client,
		BillingUnit: original.BillingUnit,
		Lines:       cloneScheduleLines(original.Lines),
		Notes:       original.Notes,
		Currency:    original.Currency,
		Status:      domain.BudgetDraft,
		IssueDate:   time.Now(),
		ValidUntil:  original.ValidUntil,
	}

	if err := s.CreateBudget(ctx, profileID, newBudget); err != nil {
		return nil, err
	}
	return newBudget, nil
}

func (s *BudgetService) ConvertBudgetToInvoice(ctx context.Context, profileID string, id string) (*domain.Invoice, error) {
	budget, err := s.GetBudget(ctx, profileID, id)
	if err != nil {
		return nil, err
	}
	if budget.ConvertedInvoiceID != "" {
		return nil, errors.New("budget already converted to invoice")
	}

	invoice := &domain.Invoice{
		Client:      budget.Client,
		BillingUnit: budget.BillingUnit,
		Lines:       cloneScheduleLines(budget.Lines),
		Notes:       budget.Notes,
		Currency:    budget.Currency,
		Status:      domain.InvoiceIssued,
		IssueDate:   time.Now(),
	}

	if err := s.invoiceService.CreateInvoice(ctx, budget.ProfileID, invoice); err != nil {
		return nil, err
	}

	budget.Status = domain.BudgetConverted
	budget.ConvertedInvoiceID = invoice.ID.Hex()
	budget.ConvertedAt = time.Now()
	if err := s.budgetRepo.Update(ctx, budget.ID.Hex(), budget); err != nil {
		return nil, err
	}

	return invoice, nil
}

func (s *BudgetService) nextAvailableSequence(ctx context.Context, profileID string, series string) (int64, error) {
	usedSequences, err := s.budgetRepo.GetUsedSequencesBySeries(ctx, profileID, series)
	if err != nil {
		return 0, err
	}

	nextSequence := int64(1)
	for _, usedSequence := range usedSequences {
		if usedSequence < nextSequence {
			continue
		}
		if usedSequence == nextSequence {
			nextSequence++
			continue
		}
		break
	}

	return nextSequence, nil
}

func validateBudgetInput(budget *domain.Budget) error {
	invoice := &domain.Invoice{
		Client:      budget.Client,
		BillingUnit: budget.BillingUnit,
		Lines:       budget.Lines,
	}
	if err := validateInvoiceInput(invoice); err != nil {
		return err
	}
	if budget.Status != "" {
		switch budget.Status {
		case domain.BudgetDraft, domain.BudgetSent, domain.BudgetAccepted, domain.BudgetRejected, domain.BudgetConverted:
		default:
			return errors.New("budget status must be draft, sent, accepted, rejected or converted")
		}
	}
	return nil
}

func normalizeBudgetStatus(status domain.BudgetStatus) domain.BudgetStatus {
	switch status {
	case domain.BudgetSent, domain.BudgetAccepted, domain.BudgetRejected, domain.BudgetConverted:
		return status
	default:
		return domain.BudgetDraft
	}
}

func budgetSeries(invoiceSeries string) string {
	if invoiceSeries == "" {
		invoiceSeries = "2026"
	}
	return fmt.Sprintf("PRES-%s", invoiceSeries)
}

func emitterDataFromProfile(profile *domain.Profile) domain.EmitterData {
	return domain.EmitterData{
		ProfileID:          profile.ID.Hex(),
		ProfileName:        profile.Name,
		ProfileType:        string(profile.Type),
		Name:               profile.Name,
		TaxID:              profile.TaxID,
		Address:            profile.Address,
		City:               profile.City,
		PostalCode:         profile.PostalCode,
		Country:            profile.Country,
		Email:              profile.Email,
		Phone:              profile.Phone,
		IBAN:               profile.IBAN,
		LogoURL:            profile.LogoURL,
		DefaultCurrency:    profile.DefaultCurrency,
		DefaultVAT:         profile.DefaultVAT,
		DefaultWithholding: profile.DefaultWithholding,
	}
}
