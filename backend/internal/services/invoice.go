package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"time"

	"facturamas-api/internal/domain"
)

type InvoiceService struct {
	invoiceRepo    domain.InvoiceRepository
	profileRepo    domain.ProfileRepository
	profileService *ProfileService
	pdfService     *PDFService
}

func (s *InvoiceService) GenerateDueSchedules(ctx context.Context, scheduleService *InvoiceScheduleService) error {
	if scheduleService == nil {
		return nil
	}
	return scheduleService.GenerateDueInvoices(ctx)
}

func NewInvoiceService(invoiceRepo domain.InvoiceRepository, profileRepo domain.ProfileRepository, profileService *ProfileService, pdfService *PDFService) *InvoiceService {
	return &InvoiceService{
		invoiceRepo:    invoiceRepo,
		profileRepo:    profileRepo,
		profileService: profileService,
		pdfService:     pdfService,
	}
}

// CreateInvoice validates, calculates, and creates an invoice
func (s *InvoiceService) CreateInvoice(ctx context.Context, profileID string, invoice *domain.Invoice) error {
	if err := validateInvoiceInput(invoice); err != nil {
		return err
	}

	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}

	// Generate invoice number reusing the first free sequence in the series.
	sequence, err := s.nextAvailableSequence(ctx, profile.ID.Hex(), profile.DefaultSeries)
	if err != nil {
		return err
	}

	invoice.ProfileID = profile.ID.Hex()
	invoice.Series = profile.DefaultSeries
	invoice.Sequence = sequence
	invoice.Number = fmt.Sprintf("%s-%05d", profile.DefaultSeries, sequence)

	// Snapshot emitter data
	invoice.Emitter = domain.EmitterData{
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

	// Set defaults
	if invoice.Currency == "" {
		invoice.Currency = profile.DefaultCurrency
	}

	if invoice.IssueDate.IsZero() {
		invoice.IssueDate = time.Now()
	}

	invoice.Status = normalizeInvoiceStatus(invoice.Status)
	if invoice.BillingUnit == "" {
		invoice.BillingUnit = domain.BillingUnitHours
	}

	// Calculate totals
	s.calculateInvoiceTotals(invoice)

	if err := s.invoiceRepo.Create(ctx, invoice); err != nil {
		return err
	}

	profile.SequenceCounter = sequence
	if err := s.profileRepo.Update(ctx, profile.ID.Hex(), profile); err != nil {
		return err
	}

	return s.ensureInvoicePDF(ctx, invoice)
}

func (s *InvoiceService) nextAvailableSequence(ctx context.Context, profileID string, series string) (int64, error) {
	usedSequences, err := s.invoiceRepo.GetUsedSequencesBySeries(ctx, profileID, series)
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

// GetInvoice retrieves a single invoice
func (s *InvoiceService) GetInvoice(ctx context.Context, profileID string, id string) (*domain.Invoice, error) {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return nil, err
	}

	invoice, err := s.invoiceRepo.GetByID(ctx, profile.ID.Hex(), id)
	if err != nil {
		return nil, err
	}

	invoice.Status = normalizeInvoiceStatus(invoice.Status)
	return invoice, nil
}

// ListInvoices retrieves all invoices
func (s *InvoiceService) ListInvoices(ctx context.Context, profileID string) ([]domain.Invoice, error) {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return nil, err
	}

	invoices, err := s.invoiceRepo.GetAll(ctx, profile.ID.Hex())
	if err != nil {
		return nil, err
	}

	for i := range invoices {
		invoices[i].Status = normalizeInvoiceStatus(invoices[i].Status)
	}

	return invoices, nil
}

// UpdateInvoice updates an existing invoice and recalculates totals
func (s *InvoiceService) UpdateInvoice(ctx context.Context, profileID string, id string, updates *domain.Invoice) error {
	// Get existing invoice
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}

	existing, err := s.invoiceRepo.GetByID(ctx, profile.ID.Hex(), id)
	if err != nil {
		return err
	}

	// Update fields
	existing.Client = updates.Client
	existing.Lines = updates.Lines
	existing.Notes = updates.Notes
	existing.Status = normalizeInvoiceStatus(updates.Status)
	existing.IssueDate = updates.IssueDate
	existing.DueDate = updates.DueDate
	if updates.BillingUnit != "" {
		existing.BillingUnit = updates.BillingUnit
	}
	if updates.Currency != "" {
		existing.Currency = updates.Currency
	}
	existing.ProfileID = profile.ID.Hex()
	// Recalculate totals
	s.calculateInvoiceTotals(existing)

	if err := s.invoiceRepo.Update(ctx, id, existing); err != nil {
		return err
	}

	return s.ensureInvoicePDF(ctx, existing)
}

// DeleteInvoice deletes an invoice
func (s *InvoiceService) DeleteInvoice(ctx context.Context, profileID string, id string) error {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}

	invoice, err := s.invoiceRepo.GetByID(ctx, profile.ID.Hex(), id)
	if err != nil {
		return err
	}

	if err := s.invoiceRepo.Delete(ctx, id); err != nil {
		return err
	}

	return s.pdfService.RemovePDF(invoice.PDFFilename)
}

// DuplicateInvoice creates a copy of an invoice with new number and date
func (s *InvoiceService) DuplicateInvoice(ctx context.Context, profileID string, id string) (*domain.Invoice, error) {
	// Get original invoice
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return nil, err
	}

	original, err := s.invoiceRepo.GetByID(ctx, profile.ID.Hex(), id)
	if err != nil {
		return nil, err
	}

	// Create copy
	newInvoice := &domain.Invoice{
		Client:    original.Client,
		Lines:     original.Lines,
		Notes:     original.Notes,
		Currency:  original.Currency,
		Status:    domain.InvoiceIssued,
		ProfileID: profile.ID.Hex(),
	}

	// Create it (which will assign new number)
	if err := s.CreateInvoice(ctx, profile.ID.Hex(), newInvoice); err != nil {
		return nil, err
	}

	return newInvoice, nil
}

func (s *InvoiceService) GetInvoicePDFPath(ctx context.Context, profileID string, id string) (string, string, error) {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return "", "", err
	}

	invoice, err := s.invoiceRepo.GetByID(ctx, profile.ID.Hex(), id)
	if err != nil {
		return "", "", err
	}

	if err := s.ensureInvoicePDF(ctx, invoice); err != nil {
		return "", "", err
	}

	path := s.pdfService.GetPDFPath(invoice.PDFFilename)
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			if err := s.ensureInvoicePDF(ctx, invoice); err != nil {
				return "", "", err
			}
			path = s.pdfService.GetPDFPath(invoice.PDFFilename)
		} else {
			return "", "", err
		}
	}

	downloadName := invoice.PDFFilename
	if invoice.Number != "" {
		downloadName = fmt.Sprintf("invoice_%s.pdf", invoice.Number)
	}

	return path, downloadName, nil
}

func (s *InvoiceService) ensureInvoicePDF(ctx context.Context, invoice *domain.Invoice) error {
	if s.pdfService == nil {
		return nil
	}

	if err := s.ensureEmitterData(ctx, invoice); err != nil {
		return err
	}

	filename, err := s.pdfService.GenerateInvoicePDF(invoice)
	if err != nil {
		return err
	}

	invoice.PDFFilename = filename
	return s.invoiceRepo.Update(ctx, invoice.ID.Hex(), invoice)
}

func (s *InvoiceService) ensureEmitterData(ctx context.Context, invoice *domain.Invoice) error {
	profile, err := s.profileService.ResolveProfile(ctx, invoice.ProfileID)
	if err != nil {
		return err
	}

	if isEmitterEmpty(invoice.Emitter) {
		invoice.Emitter = domain.EmitterData{
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
	} else {
		if invoice.Emitter.ProfileID == "" {
			invoice.Emitter.ProfileID = profile.ID.Hex()
		}
		if invoice.Emitter.ProfileName == "" {
			invoice.Emitter.ProfileName = profile.Name
		}
		if invoice.Emitter.ProfileType == "" {
			invoice.Emitter.ProfileType = string(profile.Type)
		}
		if invoice.Emitter.Name == "" {
			invoice.Emitter.Name = profile.Name
		}
		if invoice.Emitter.TaxID == "" {
			invoice.Emitter.TaxID = profile.TaxID
		}
		if invoice.Emitter.Address == "" {
			invoice.Emitter.Address = profile.Address
		}
		if invoice.Emitter.City == "" {
			invoice.Emitter.City = profile.City
		}
		if invoice.Emitter.PostalCode == "" {
			invoice.Emitter.PostalCode = profile.PostalCode
		}
		if invoice.Emitter.Country == "" {
			invoice.Emitter.Country = profile.Country
		}
		if invoice.Emitter.Email == "" {
			invoice.Emitter.Email = profile.Email
		}
		if invoice.Emitter.Phone == "" {
			invoice.Emitter.Phone = profile.Phone
		}
		if invoice.Emitter.IBAN == "" {
			invoice.Emitter.IBAN = profile.IBAN
		}
		if invoice.Emitter.LogoURL == "" {
			invoice.Emitter.LogoURL = profile.LogoURL
		}
		if invoice.Emitter.DefaultCurrency == "" {
			invoice.Emitter.DefaultCurrency = profile.DefaultCurrency
		}
		if invoice.Emitter.DefaultVAT == 0 {
			invoice.Emitter.DefaultVAT = profile.DefaultVAT
		}
		if invoice.Emitter.DefaultWithholding == 0 {
			invoice.Emitter.DefaultWithholding = profile.DefaultWithholding
		}
	}

	if invoice.Currency == "" {
		invoice.Currency = profile.DefaultCurrency
	}

	return nil
}

func (s *InvoiceService) calculateInvoiceTotals(invoice *domain.Invoice) {
	calculateTotalsFromLines(
		invoice.Lines,
		&invoice.Subtotal,
		&invoice.VATAmount,
		&invoice.WithholdingAmount,
		&invoice.GrandTotal,
	)
}

func calculateTotalsFromLines(lines []domain.InvoiceLine, subtotalOut *float64, vatAmountOut *float64, withholdingAmountOut *float64, grandTotalOut *float64) {
	subtotal := 0.0
	vatAmount := 0.0
	withholdingAmount := 0.0

	for i := range lines {
		line := &lines[i]

		line.Subtotal = round(line.Quantity * line.UnitPrice)
		line.VATAmount = round(line.Subtotal * line.VAT / 100)
		line.WithholdingAmount = round(line.Subtotal * line.Withholding / 100)
		line.LineTotal = round(line.Subtotal + line.VATAmount - line.WithholdingAmount)

		subtotal += line.Subtotal
		vatAmount += line.VATAmount
		withholdingAmount += line.WithholdingAmount
	}

	*subtotalOut = round(subtotal)
	*vatAmountOut = round(vatAmount)
	*withholdingAmountOut = round(withholdingAmount)
	*grandTotalOut = round(*subtotalOut + *vatAmountOut - *withholdingAmountOut)
}

func validateInvoiceInput(invoice *domain.Invoice) error {
	if invoice.Client.Name == "" {
		return errors.New("client name is required")
	}
	if invoice.Client.Address == "" {
		return errors.New("client address is required")
	}
	if invoice.Client.City == "" {
		return errors.New("client city is required")
	}
	if invoice.Client.PostalCode == "" {
		return errors.New("client postal code is required")
	}
	if invoice.Client.Country == "" {
		return errors.New("client country is required")
	}

	if len(invoice.Lines) == 0 {
		return errors.New("invoice must have at least one line")
	}

	if invoice.BillingUnit != "" && invoice.BillingUnit != domain.BillingUnitHours && invoice.BillingUnit != domain.BillingUnitDays && invoice.BillingUnit != domain.BillingUnitService {
		return errors.New("billing unit must be hours, days or service")
	}

	for i, line := range invoice.Lines {
		if line.Description == "" {
			return errors.New("line description is required")
		}

		if invoice.BillingUnit == domain.BillingUnitService {
			if line.Quantity == 0 {
				line.Quantity = 1
				invoice.Lines[i].Quantity = 1
			}
		}

		if line.Quantity <= 0 {
			return errors.New("line quantity must be positive")
		}

		if line.UnitPrice < 0 {
			return errors.New("line unit price cannot be negative")
		}

		if line.VAT < 0 || line.VAT > 100 {
			return errors.New("VAT percentage must be between 0 and 100")
		}

		if line.Withholding < 0 || line.Withholding > 100 {
			return errors.New("withholding percentage must be between 0 and 100")
		}

		// Prevent decimal overflow
		if line.Quantity > 1e10 || line.UnitPrice > 1e10 {
			return errors.New("values too large at line " + fmt.Sprintf("%d", i))
		}
	}

	return nil
}

func round(val float64) float64 {
	return math.Round(val*100) / 100
}

func normalizeInvoiceStatus(status domain.InvoiceStatus) domain.InvoiceStatus {
	if status == domain.InvoicePaid {
		return domain.InvoicePaid
	}

	return domain.InvoiceIssued
}

func isEmitterEmpty(emitter domain.EmitterData) bool {
	return emitter.Name == "" &&
		emitter.TaxID == "" &&
		emitter.Address == "" &&
		emitter.City == "" &&
		emitter.PostalCode == "" &&
		emitter.Country == "" &&
		emitter.Email == "" &&
		emitter.Phone == "" &&
		emitter.IBAN == ""
}
