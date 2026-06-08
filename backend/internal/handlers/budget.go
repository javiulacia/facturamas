package handlers

import (
	"net/http"

	"facturamas-api/internal/domain"
	"facturamas-api/internal/services"
	"github.com/gin-gonic/gin"
)

type BudgetHandler struct {
	service *services.BudgetService
}

func NewBudgetHandler(service *services.BudgetService) *BudgetHandler {
	return &BudgetHandler{service: service}
}

func (h *BudgetHandler) CreateBudget(c *gin.Context) {
	var budget domain.Budget
	if err := c.ShouldBindJSON(&budget); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.CreateBudget(c.Request.Context(), getProfileID(c), &budget); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, budget)
}

func (h *BudgetHandler) ListBudgets(c *gin.Context) {
	budgets, err := h.service.ListBudgets(c.Request.Context(), getProfileID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, budgets)
}

func (h *BudgetHandler) GetBudget(c *gin.Context) {
	budget, err := h.service.GetBudget(c.Request.Context(), getProfileID(c), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, budget)
}

func (h *BudgetHandler) UpdateBudget(c *gin.Context) {
	var budget domain.Budget
	if err := c.ShouldBindJSON(&budget); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdateBudget(c.Request.Context(), getProfileID(c), c.Param("id"), &budget); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, _ := h.service.GetBudget(c.Request.Context(), getProfileID(c), c.Param("id"))
	c.JSON(http.StatusOK, updated)
}

func (h *BudgetHandler) DeleteBudget(c *gin.Context) {
	if err := h.service.DeleteBudget(c.Request.Context(), getProfileID(c), c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "budget deleted"})
}

func (h *BudgetHandler) DuplicateBudget(c *gin.Context) {
	budget, err := h.service.DuplicateBudget(c.Request.Context(), getProfileID(c), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, budget)
}

func (h *BudgetHandler) ConvertBudgetToInvoice(c *gin.Context) {
	invoice, err := h.service.ConvertBudgetToInvoice(c.Request.Context(), getProfileID(c), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, invoiceToResponse(invoice))
}
