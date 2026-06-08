package handlers

import (
	"net/http"

	"facturamas-api/internal/domain"
	"facturamas-api/internal/services"
	"github.com/gin-gonic/gin"
)

type ClientHandler struct {
	service *services.ClientService
}

func NewClientHandler(service *services.ClientService) *ClientHandler {
	return &ClientHandler{service: service}
}

func (h *ClientHandler) CreateClient(c *gin.Context) {
	var client domain.Client
	if err := c.ShouldBindJSON(&client); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.CreateClient(c.Request.Context(), getProfileID(c), &client); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, client)
}

func (h *ClientHandler) GetClient(c *gin.Context) {
	client, err := h.service.GetClient(c.Request.Context(), getProfileID(c), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, client)
}

func (h *ClientHandler) ListClients(c *gin.Context) {
	clients, err := h.service.ListClients(c.Request.Context(), getProfileID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, clients)
}

func (h *ClientHandler) UpdateClient(c *gin.Context) {
	var client domain.Client
	if err := c.ShouldBindJSON(&client); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdateClient(c.Request.Context(), getProfileID(c), c.Param("id"), &client); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, _ := h.service.GetClient(c.Request.Context(), getProfileID(c), c.Param("id"))
	c.JSON(http.StatusOK, updated)
}

func (h *ClientHandler) DeleteClient(c *gin.Context) {
	if err := h.service.DeleteClient(c.Request.Context(), getProfileID(c), c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "client deleted"})
}
