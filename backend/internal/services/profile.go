package services

import (
	"context"
	"strings"
	"time"

	"facturamas-api/internal/domain"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	profileKeySelfEmployed = "autonomo"
	profileKeyCompany      = "sociedad"
)

type ProfileService struct {
	repo domain.ProfileRepository
}

func NewProfileService(repo domain.ProfileRepository) *ProfileService {
	return &ProfileService{
		repo: repo,
	}
}

func (s *ProfileService) EnsureBaseProfiles(ctx context.Context) error {
	if _, err := s.ensureProfile(ctx, profileKeySelfEmployed, domain.ProfileTypeSelfEmployed, true); err != nil {
		return err
	}
	if _, err := s.ensureProfile(ctx, profileKeyCompany, domain.ProfileTypeCompany, false); err != nil {
		return err
	}
	return nil
}

func (s *ProfileService) ensureProfile(ctx context.Context, key string, profileType domain.ProfileType, isDefault bool) (*domain.Profile, error) {
	existing, err := s.repo.GetByKey(ctx, key)
	if err == nil {
		needsUpdate := false
		if existing.Key == "" {
			existing.Key = key
			needsUpdate = true
		}
		if existing.Type == "" {
			existing.Type = profileType
			needsUpdate = true
		}
		if isDefault && !existing.IsDefault {
			existing.IsDefault = true
			needsUpdate = true
		}
		if needsUpdate {
			if err := s.repo.Update(ctx, existing.ID.Hex(), existing); err != nil {
				return nil, err
			}
		}
		return existing, nil
	}

	profile := buildBaseProfile(key, profileType, isDefault)
	profile.ID = primitive.NewObjectID()
	if err := s.repo.Update(ctx, profile.ID.Hex(), profile); err != nil {
		return nil, err
	}
	return profile, nil
}

func (s *ProfileService) ResolveProfile(ctx context.Context, profileID string) (*domain.Profile, error) {
	if strings.TrimSpace(profileID) == "" {
		return s.repo.GetDefault(ctx)
	}
	return s.repo.GetByID(ctx, profileID)
}

func (s *ProfileService) ListProfiles(ctx context.Context) ([]domain.Profile, error) {
	return s.repo.GetAll(ctx)
}

func (s *ProfileService) UpdateProfile(ctx context.Context, id string, profile *domain.Profile) error {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}

	existing.Name = strings.TrimSpace(profile.Name)
	existing.TaxID = strings.TrimSpace(profile.TaxID)
	existing.Address = strings.TrimSpace(profile.Address)
	existing.City = strings.TrimSpace(profile.City)
	existing.PostalCode = strings.TrimSpace(profile.PostalCode)
	existing.Country = strings.TrimSpace(profile.Country)
	existing.Email = strings.TrimSpace(profile.Email)
	existing.Phone = strings.TrimSpace(profile.Phone)
	existing.IBAN = strings.TrimSpace(profile.IBAN)
	existing.LogoURL = strings.TrimSpace(profile.LogoURL)
	existing.DefaultCurrency = strings.TrimSpace(profile.DefaultCurrency)
	existing.DefaultVAT = profile.DefaultVAT
	existing.DefaultWithholding = profile.DefaultWithholding
	existing.DefaultSeries = strings.TrimSpace(profile.DefaultSeries)

	if err := validateSettings((*domain.Settings)(existing)); err != nil {
		return err
	}

	return s.repo.Update(ctx, id, existing)
}

func buildBaseProfile(key string, profileType domain.ProfileType, isDefault bool) *domain.Profile {
	now := time.Now()
	profile := &domain.Profile{
		Key:                key,
		Type:               profileType,
		IsDefault:          isDefault,
		Name:               "Perfil sin configurar",
		TaxID:              "PENDIENTE",
		Address:            "Pendiente de completar",
		City:               "Pendiente",
		PostalCode:         "00000",
		Country:            "Espana",
		Email:              "pendiente@example.com",
		DefaultCurrency:    "EUR",
		DefaultVAT:         21,
		DefaultWithholding: 15,
		DefaultSeries:      "2026",
		SequenceCounter:    0,
		CreatedAt:          now,
		UpdatedAt:          now,
	}

	if profileType == domain.ProfileTypeSelfEmployed {
		profile.Name = "Autonomo"
	}
	if profileType == domain.ProfileTypeCompany {
		profile.Name = "Sociedad"
		profile.DefaultWithholding = 0
		profile.DefaultSeries = "SOC-2026"
	}

	return profile
}
