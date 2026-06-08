package handlers

import (
	"net/http"

	"facturamas-api/internal/domain"
	"facturamas-api/internal/services"
	"github.com/gin-gonic/gin"
)

type ContactHandler struct {
	service *services.ContactService
}

func NewContactHandler(service *services.ContactService) *ContactHandler {
	return &ContactHandler{service: service}
}

func (h *ContactHandler) CreateContact(c *gin.Context) {
	var contact domain.Contact
	if err := c.ShouldBindJSON(&contact); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.CreateContact(c.Request.Context(), getProfileID(c), &contact); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, contact)
}

func (h *ContactHandler) GetContact(c *gin.Context) {
	contact, err := h.service.GetContact(c.Request.Context(), getProfileID(c), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, contact)
}

func (h *ContactHandler) ListContacts(c *gin.Context) {
	contacts, err := h.service.ListContacts(c.Request.Context(), getProfileID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, contacts)
}

func (h *ContactHandler) UpdateContact(c *gin.Context) {
	var contact domain.Contact
	if err := c.ShouldBindJSON(&contact); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdateContact(c.Request.Context(), getProfileID(c), c.Param("id"), &contact); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, _ := h.service.GetContact(c.Request.Context(), getProfileID(c), c.Param("id"))
	c.JSON(http.StatusOK, updated)
}

func (h *ContactHandler) DeleteContact(c *gin.Context) {
	if err := h.service.DeleteContact(c.Request.Context(), getProfileID(c), c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "contact deleted"})
}
