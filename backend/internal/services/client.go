package services

import (
	"context"
	"errors"

	"facturamas-api/internal/domain"
)

type ClientService struct {
	repo           domain.ClientRepository
	profileService *ProfileService
}

func NewClientService(repo domain.ClientRepository, profileService *ProfileService) *ClientService {
	return &ClientService{repo: repo, profileService: profileService}
}

func (s *ClientService) CreateClient(ctx context.Context, profileID string, client *domain.Client) error {
	if err := validateClient(client); err != nil {
		return err
	}
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}
	client.ProfileID = profile.ID.Hex()
	return s.repo.Create(ctx, client)
}

func (s *ClientService) GetClient(ctx context.Context, profileID string, id string) (*domain.Client, error) {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetByID(ctx, profile.ID.Hex(), id)
}

func (s *ClientService) ListClients(ctx context.Context, profileID string) ([]domain.Client, error) {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetAll(ctx, profile.ID.Hex())
}

func (s *ClientService) UpdateClient(ctx context.Context, profileID string, id string, updates *domain.Client) error {
	if err := validateClient(updates); err != nil {
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

	existing.Name = updates.Name
	existing.TaxID = updates.TaxID
	existing.Address = updates.Address
	existing.City = updates.City
	existing.PostalCode = updates.PostalCode
	existing.Country = updates.Country
	existing.Email = updates.Email
	existing.ProfileID = profile.ID.Hex()

	return s.repo.Update(ctx, id, existing)
}

func (s *ClientService) DeleteClient(ctx context.Context, profileID string, id string) error {
	profile, err := s.profileService.ResolveProfile(ctx, profileID)
	if err != nil {
		return err
	}
	if _, err := s.repo.GetByID(ctx, profile.ID.Hex(), id); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}

func validateClient(client *domain.Client) error {
	if client.Name == "" {
		return errors.New("client name is required")
	}
	if client.TaxID == "" {
		return errors.New("client tax id is required")
	}
	if client.Address == "" {
		return errors.New("client address is required")
	}
	if client.City == "" {
		return errors.New("client city is required")
	}
	if client.PostalCode == "" {
		return errors.New("client postal code is required")
	}
	if client.Country == "" {
		return errors.New("client country is required")
	}
	return nil
}
