package handlers

import (
	"fmt"
	"net/http"

	"facturamas-api/internal/domain"
	"facturamas-api/internal/services"
	"github.com/gin-gonic/gin"
)

type SettingsHandler struct {
	service *services.SettingsService
}

func NewSettingsHandler(service *services.SettingsService) *SettingsHandler {
	return &SettingsHandler{
		service: service,
	}
}

// GetSettings retrieves current settings
func (h *SettingsHandler) GetSettings(c *gin.Context) {
	settings, err := h.service.GetSettings(c.Request.Context(), getProfileID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// UpdateSettings updates settings
func (h *SettingsHandler) UpdateSettings(c *gin.Context) {
	var settings domain.Settings
	if err := c.ShouldBindJSON(&settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdateSettings(c.Request.Context(), getProfileID(c), &settings); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, settings)
}

// ResetInvoices clears the invoices collection and resets numbering.
func (h *SettingsHandler) ResetInvoices(c *gin.Context) {
	if err := h.service.ResetInvoices(c.Request.Context(), getProfileID(c)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "invoices reset completed"})
}

// ResetClients clears the clients collection.
func (h *SettingsHandler) ResetClients(c *gin.Context) {
	if err := h.service.ResetClients(c.Request.Context(), getProfileID(c)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "clients reset completed"})
}

// ResetContacts clears the contacts collection.
func (h *SettingsHandler) ResetContacts(c *gin.Context) {
	if err := h.service.ResetContacts(c.Request.Context(), getProfileID(c)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "contacts reset completed"})
}

func (h *SettingsHandler) ExportBackup(c *gin.Context) {
	backup, err := h.service.ExportBackup(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	filename := fmt.Sprintf("facturamas-backup-%s.json", backup.ExportedAt.Format("2006-01-02"))
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.JSON(http.StatusOK, backup)
}

func (h *SettingsHandler) ImportBackup(c *gin.Context) {
	var backup domain.BackupData
	if err := c.ShouldBindJSON(&backup); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.ImportBackup(c.Request.Context(), &backup); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "backup imported successfully"})
}

func (h *SettingsHandler) SyncProfiles(c *gin.Context) {
	if err := h.service.SyncClientsAndContactsAcrossProfiles(c.Request.Context()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "clients and contacts synchronized successfully"})
}
