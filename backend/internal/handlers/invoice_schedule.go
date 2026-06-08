package handlers

import (
	"net/http"

	"facturamas-api/internal/domain"
	"facturamas-api/internal/services"
	"github.com/gin-gonic/gin"
)

type InvoiceScheduleHandler struct {
	service *services.InvoiceScheduleService
}

func NewInvoiceScheduleHandler(service *services.InvoiceScheduleService) *InvoiceScheduleHandler {
	return &InvoiceScheduleHandler{service: service}
}

func (h *InvoiceScheduleHandler) ListSchedules(c *gin.Context) {
	schedules, err := h.service.ListSchedules(c.Request.Context(), getProfileID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, schedules)
}

func (h *InvoiceScheduleHandler) GetSchedule(c *gin.Context) {
	schedule, err := h.service.GetSchedule(c.Request.Context(), getProfileID(c), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, schedule)
}

func (h *InvoiceScheduleHandler) CreateSchedule(c *gin.Context) {
	var schedule domain.InvoiceSchedule
	if err := c.ShouldBindJSON(&schedule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.CreateSchedule(c.Request.Context(), getProfileID(c), &schedule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, schedule)
}

func (h *InvoiceScheduleHandler) UpdateSchedule(c *gin.Context) {
	var schedule domain.InvoiceSchedule
	if err := c.ShouldBindJSON(&schedule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdateSchedule(c.Request.Context(), getProfileID(c), c.Param("id"), &schedule); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, _ := h.service.GetSchedule(c.Request.Context(), getProfileID(c), c.Param("id"))
	c.JSON(http.StatusOK, updated)
}

func (h *InvoiceScheduleHandler) DeleteSchedule(c *gin.Context) {
	if err := h.service.DeleteSchedule(c.Request.Context(), getProfileID(c), c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "invoice schedule deleted"})
}

func (h *InvoiceScheduleHandler) GenerateDueInvoices(c *gin.Context) {
	schedule, generatedCount, err := h.service.GenerateDueInvoicesForSchedule(c.Request.Context(), getProfileID(c), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"generatedCount": generatedCount,
		"schedule":       schedule,
	})
}
