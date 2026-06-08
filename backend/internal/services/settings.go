package services

import (
	"context"
	"errors"
	"strings"

	"facturamas-api/internal/domain"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type SettingsService struct {
	profileService *ProfileService
	profileRepo    domain.ProfileRepository
	invoiceRepo    domain.InvoiceRepository
	budgetRepo     domain.BudgetRepository
	clientRepo     domain.ClientRepository
	contactRepo    domain.ContactRepository
	logoAssets     *LogoAssetService
}

func NewSettingsService(profileService *ProfileService, profileRepo domain.ProfileRepository, invoiceRepo domain.InvoiceRepository, budgetRepo domain.BudgetRepository, clientRepo domain.ClientRepository, contactRepo domain.ContactRepository, logoAssets *LogoAssetService) *SettingsService {
	return &SettingsService{
		profileService: profileService,
		profileRepo:    profileRepo,
		invoiceRepo:    invoiceRepo,
		budgetRepo:     budgetRepo,
		clientRepo:     clientRepo,
		contactRepo:    contactRepo,
		logoAssets:     logoAssets,
	}
}

func (s *SettingsService) GetSettings(ctx context.Context, profileID string) (*domain.Settings, error) {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return nil, err
	}
	return (*domain.Settings)(profile), nil
}

func (s *SettingsService) UpdateSettings(ctx context.Context, profileID string, settings *domain.Settings) error {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}
	settings.ID = profile.ID
	settings.Key = profile.Key
	settings.Type = profile.Type
	settings.IsDefault = profile.IsDefault
	settings.SequenceCounter = profile.SequenceCounter
	settings.CreatedAt = profile.CreatedAt

	if s.logoAssets != nil {
		logoURL, err := s.logoAssets.NormalizeLogoURL(ctx, profile.ID.Hex(), settings.LogoURL)
		if err != nil {
			return err
		}
		settings.LogoURL = logoURL
	}

	if err := validateSettings(settings); err != nil {
		return err
	}

	return s.profileRepo.Update(ctx, profile.ID.Hex(), (*domain.Profile)(settings))
}

func (s *SettingsService) ResetInvoices(ctx context.Context, profileID string) error {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}

	if err := s.invoiceRepo.DeleteAll(ctx, profile.ID.Hex()); err != nil {
		return err
	}

	profile.SequenceCounter = 0
	return s.profileRepo.Update(ctx, profile.ID.Hex(), profile)
}

func (s *SettingsService) ResetClients(ctx context.Context, profileID string) error {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}
	return s.clientRepo.DeleteAll(ctx, profile.ID.Hex())
}

func (s *SettingsService) ResetContacts(ctx context.Context, profileID string) error {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}
	return s.contactRepo.DeleteAll(ctx, profile.ID.Hex())
}

func (s *SettingsService) SyncClientsAndContactsAcrossProfiles(ctx context.Context) error {
	profiles, err := s.profileRepo.GetAll(ctx)
	if err != nil {
		return err
	}
	if len(profiles) < 2 {
		return errors.New("at least two profiles are required")
	}

	allClients, err := s.clientRepo.GetAll(ctx, "")
	if err != nil {
		return err
	}

	allContacts, err := s.contactRepo.GetAll(ctx, "")
	if err != nil {
		return err
	}

	canonicalClients := dedupeClients(allClients)
	canonicalContacts := dedupeContacts(allContacts)

	syncedClients := make([]domain.Client, 0, len(canonicalClients)*len(profiles))
	for _, profile := range profiles {
		for _, client := range canonicalClients {
			clientCopy := client
			clientCopy.ID = primitive.NilObjectID
			clientCopy.ProfileID = profile.ID.Hex()
			syncedClients = append(syncedClients, clientCopy)
		}
	}

	syncedContacts := make([]domain.Contact, 0, len(canonicalContacts)*len(profiles))
	for _, profile := range profiles {
		for _, contact := range canonicalContacts {
			contactCopy := contact
			contactCopy.ID = primitive.NilObjectID
			contactCopy.ProfileID = profile.ID.Hex()
			syncedContacts = append(syncedContacts, contactCopy)
		}
	}

	if err := s.clientRepo.ReplaceAll(ctx, syncedClients); err != nil {
		return err
	}
	return s.contactRepo.ReplaceAll(ctx, syncedContacts)
}

func (s *SettingsService) ExportBackup(ctx context.Context) (*domain.BackupData, error) {
	profiles, err := s.profileRepo.GetAll(ctx)
	if err != nil {
		return nil, err
	}

	clients, err := s.clientRepo.GetAll(ctx, "")
	if err != nil {
		return nil, err
	}

	contacts, err := s.contactRepo.GetAll(ctx, "")
	if err != nil {
		return nil, err
	}

	invoices, err := s.invoiceRepo.GetAll(ctx, "")
	if err != nil {
		return nil, err
	}

	budgets, err := s.budgetRepo.GetAll(ctx, "")
	if err != nil {
		return nil, err
	}

	currentSettings := domain.Settings{}
	if len(profiles) > 0 {
		currentSettings = domain.Settings(profiles[0])
	}

	return &domain.BackupData{
		Version:    2,
		ExportedAt: primitive.NewObjectID().Timestamp(),
		Settings:   currentSettings,
		Profiles:   profiles,
		Clients:    clients,
		Contacts:   contacts,
		Invoices:   invoices,
		Budgets:    budgets,
	}, nil
}

func (s *SettingsService) ImportBackup(ctx context.Context, backup *domain.BackupData) error {
	if backup == nil {
		return errors.New("backup is required")
	}
	if backup.Version <= 0 {
		return errors.New("backup version is required")
	}

	profiles := backup.Profiles
	if len(profiles) == 0 {
		return errors.New("backup profiles are required")
	}

	for i := range profiles {
		if err := validateSettings((*domain.Settings)(&profiles[i])); err != nil {
			return err
		}
	}

	defaultProfileID := ""
	profileIDMap := map[string]string{}
	for i := range profiles {
		previousProfileID := ""
		if !profiles[i].ID.IsZero() {
			previousProfileID = profiles[i].ID.Hex()
		}
		profiles[i].ID = primitive.NewObjectID()
		if profiles[i].IsDefault && defaultProfileID == "" {
			defaultProfileID = profiles[i].ID.Hex()
		}
		if previousProfileID != "" {
			profileIDMap[previousProfileID] = profiles[i].ID.Hex()
		}
	}

	for i := range backup.Clients {
		if backup.Clients[i].ProfileID == "" {
			backup.Clients[i].ProfileID = defaultProfileID
		} else if mappedProfileID, ok := profileIDMap[backup.Clients[i].ProfileID]; ok {
			backup.Clients[i].ProfileID = mappedProfileID
		}
		if err := validateClient(&backup.Clients[i]); err != nil {
			return err
		}
	}

	for i := range backup.Contacts {
		if backup.Contacts[i].ProfileID == "" {
			backup.Contacts[i].ProfileID = defaultProfileID
		} else if mappedProfileID, ok := profileIDMap[backup.Contacts[i].ProfileID]; ok {
			backup.Contacts[i].ProfileID = mappedProfileID
		}
		if err := validateContact(&backup.Contacts[i]); err != nil {
			return err
		}
	}

	for i := range backup.Invoices {
		if backup.Invoices[i].ProfileID == "" {
			backup.Invoices[i].ProfileID = defaultProfileID
		} else if mappedProfileID, ok := profileIDMap[backup.Invoices[i].ProfileID]; ok {
			backup.Invoices[i].ProfileID = mappedProfileID
		}
		if backup.Invoices[i].Emitter.ProfileID != "" {
			if mappedProfileID, ok := profileIDMap[backup.Invoices[i].Emitter.ProfileID]; ok {
				backup.Invoices[i].Emitter.ProfileID = mappedProfileID
			}
		}
		backup.Invoices[i].Status = normalizeInvoiceStatus(backup.Invoices[i].Status)
		if err := validateInvoiceInput(&backup.Invoices[i]); err != nil {
			return err
		}
	}

	for i := range backup.Budgets {
		if backup.Budgets[i].ProfileID == "" {
			backup.Budgets[i].ProfileID = defaultProfileID
		} else if mappedProfileID, ok := profileIDMap[backup.Budgets[i].ProfileID]; ok {
			backup.Budgets[i].ProfileID = mappedProfileID
		}
		if backup.Budgets[i].Emitter.ProfileID != "" {
			if mappedProfileID, ok := profileIDMap[backup.Budgets[i].Emitter.ProfileID]; ok {
				backup.Budgets[i].Emitter.ProfileID = mappedProfileID
			}
		}
		if err := validateBudgetInput(&backup.Budgets[i]); err != nil {
			return err
		}
	}

	if err := s.profileRepo.ReplaceAll(ctx, profiles); err != nil {
		return err
	}
	if err := s.clientRepo.ReplaceAll(ctx, backup.Clients); err != nil {
		return err
	}
	if err := s.contactRepo.ReplaceAll(ctx, backup.Contacts); err != nil {
		return err
	}
	if err := s.invoiceRepo.ReplaceAll(ctx, backup.Invoices); err != nil {
		return err
	}
	if err := s.budgetRepo.ReplaceAll(ctx, backup.Budgets); err != nil {
		return err
	}
	return nil
}

func validateSettings(settings *domain.Settings) error {
	if settings.Name == "" {
		return errors.New("name is required")
	}
	if settings.TaxID == "" {
		return errors.New("tax ID is required")
	}
	if settings.Address == "" {
		return errors.New("address is required")
	}
	if settings.PostalCode == "" {
		return errors.New("postal code is required")
	}
	if settings.City == "" {
		return errors.New("city is required")
	}
	if settings.Country == "" {
		return errors.New("country is required")
	}
	if settings.Email == "" {
		return errors.New("email is required")
	}
	if settings.DefaultCurrency == "" {
		return errors.New("default currency is required")
	}
	if settings.DefaultVAT < 0 || settings.DefaultVAT > 100 {
		return errors.New("default VAT must be between 0 and 100")
	}
	if settings.DefaultWithholding < 0 || settings.DefaultWithholding > 100 {
		return errors.New("default withholding must be between 0 and 100")
	}
	if settings.DefaultSeries == "" {
		return errors.New("default series is required")
	}
	return nil
}

func dedupeClients(clients []domain.Client) []domain.Client {
	seen := make(map[string]struct{}, len(clients))
	result := make([]domain.Client, 0, len(clients))
	for _, client := range clients {
		key := strings.ToLower(strings.TrimSpace(client.TaxID))
		if key == "" {
			key = strings.ToLower(strings.Join([]string{
				strings.TrimSpace(client.Name),
				strings.TrimSpace(client.Address),
				strings.TrimSpace(client.City),
				strings.TrimSpace(client.Email),
			}, "|"))
		}
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, client)
	}
	return result
}

func dedupeContacts(contacts []domain.Contact) []domain.Contact {
	seen := make(map[string]struct{}, len(contacts))
	result := make([]domain.Contact, 0, len(contacts))
	for _, contact := range contacts {
		key := strings.ToLower(strings.Join([]string{
			strings.TrimSpace(contact.Email),
			strings.TrimSpace(contact.Name),
			strings.TrimSpace(contact.Company),
			strings.TrimSpace(contact.Phone),
		}, "|"))
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, contact)
	}
	return result
}
