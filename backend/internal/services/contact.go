package services

import (
	"context"
	"errors"
	"strings"

	"facturamas-api/internal/domain"
)

type ContactService struct {
	repo           domain.ContactRepository
	profileService *ProfileService
}

func NewContactService(repo domain.ContactRepository, profileService *ProfileService) *ContactService {
	return &ContactService{repo: repo, profileService: profileService}
}

func (s *ContactService) CreateContact(ctx context.Context, profileID string, contact *domain.Contact) error {
	if err := validateContact(contact); err != nil {
		return err
	}
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}
	contact.ProfileID = profile.ID.Hex()
	return s.repo.Create(ctx, contact)
}

func (s *ContactService) GetContact(ctx context.Context, profileID string, id string) (*domain.Contact, error) {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, profile.ID.Hex(), id)
}

func (s *ContactService) ListContacts(ctx context.Context, profileID string) ([]domain.Contact, error) {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetAll(ctx, profile.ID.Hex())
}

func (s *ContactService) UpdateContact(ctx context.Context, profileID string, id string, updates *domain.Contact) error {
	if err := validateContact(updates); err != nil {
		return err
	}

	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}

	existing, err := s.repo.GetByID(ctx, profile.ID.Hex(), id)
	if err != nil {
		return err
	}

	existing.Company = strings.TrimSpace(updates.Company)
	existing.Name = strings.TrimSpace(updates.Name)
	existing.Role = strings.TrimSpace(updates.Role)
	existing.Phone = strings.TrimSpace(updates.Phone)
	existing.Email = strings.TrimSpace(updates.Email)
	existing.ProfileID = profile.ID.Hex()

	return s.repo.Update(ctx, id, existing)
}

func (s *ContactService) DeleteContact(ctx context.Context, profileID string, id string) error {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}
	if _, err := s.repo.GetByID(ctx, profile.ID.Hex(), id); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}

func validateContact(contact *domain.Contact) error {
	if strings.TrimSpace(contact.Name) == "" {
		return errors.New("contact name is required")
	}
	return nil
}
