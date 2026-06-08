package handlers

import (
	"net/http"

	"facturamas-api/internal/domain"
	"facturamas-api/internal/services"
	"github.com/gin-gonic/gin"
)

type ProfileHandler struct {
	service *services.ProfileService
}

func NewProfileHandler(service *services.ProfileService) *ProfileHandler {
	return &ProfileHandler{service: service}
}

func (h *ProfileHandler) ListProfiles(c *gin.Context) {
	profiles, err := h.service.ListProfiles(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, profiles)
}

func (h *ProfileHandler) GetProfile(c *gin.Context) {
	profile, err := h.service.ResolveProfile(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, profile)
}

func (h *ProfileHandler) UpdateProfile(c *gin.Context) {
	var profilePayload struct {
		Name               string  `json:"name"`
		TaxID              string  `json:"taxId"`
		Address            string  `json:"address"`
		City               string  `json:"city"`
		PostalCode         string  `json:"postalCode"`
		Country            string  `json:"country"`
		Email              string  `json:"email"`
		Phone              string  `json:"phone"`
		IBAN               string  `json:"iban"`
		LogoURL            string  `json:"logoUrl"`
		DefaultCurrency    string  `json:"defaultCurrency"`
		DefaultVAT         float64 `json:"defaultVat"`
		DefaultWithholding float64 `json:"defaultWithholding"`
		DefaultSeries      string  `json:"defaultSeries"`
	}

	if err := c.ShouldBindJSON(&profilePayload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	profile := h.toProfile(profilePayload)
	if err := h.service.UpdateProfile(c.Request.Context(), c.Param("id"), profile); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.service.ResolveProfile(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

func (h *ProfileHandler) toProfile(payload struct {
	Name               string  `json:"name"`
	TaxID              string  `json:"taxId"`
	Address            string  `json:"address"`
	City               string  `json:"city"`
	PostalCode         string  `json:"postalCode"`
	Country            string  `json:"country"`
	Email              string  `json:"email"`
	Phone              string  `json:"phone"`
	IBAN               string  `json:"iban"`
	LogoURL            string  `json:"logoUrl"`
	DefaultCurrency    string  `json:"defaultCurrency"`
	DefaultVAT         float64 `json:"defaultVat"`
	DefaultWithholding float64 `json:"defaultWithholding"`
	DefaultSeries      string  `json:"defaultSeries"`
}) *domain.Profile {
	return &domain.Profile{
		Name:               payload.Name,
		TaxID:              payload.TaxID,
		Address:            payload.Address,
		City:               payload.City,
		PostalCode:         payload.PostalCode,
		Country:            payload.Country,
		Email:              payload.Email,
		Phone:              payload.Phone,
		IBAN:               payload.IBAN,
		LogoURL:            payload.LogoURL,
		DefaultCurrency:    payload.DefaultCurrency,
		DefaultVAT:         payload.DefaultVAT,
		DefaultWithholding: payload.DefaultWithholding,
		DefaultSeries:      payload.DefaultSeries,
	}
}
