package handlers

import (
	"fmt"
	"net/http"

	"facturamas-api/internal/domain"
	"facturamas-api/internal/services"
	"github.com/gin-gonic/gin"
)

type InvoiceHandler struct {
	service         *services.InvoiceService
	scheduleService *services.InvoiceScheduleService
}

func NewInvoiceHandler(service *services.InvoiceService, scheduleService *services.InvoiceScheduleService) *InvoiceHandler {
	return &InvoiceHandler{
		service:         service,
		scheduleService: scheduleService,
	}
}

// InvoiceResponse is the JSON response version of Invoice with ID as string
type InvoiceResponse struct {
	ID                string               `json:"id"`
	ProfileID         string               `json:"profileId"`
	Number            string               `json:"number"`
	Series            string               `json:"series"`
	Sequence          int64                `json:"sequence"`
	IssueDate         string               `json:"issueDate"`
	DueDate           string               `json:"dueDate"`
	Status            string               `json:"status"`
	Emitter           domain.EmitterData   `json:"emitter"`
	Client            domain.ClientData    `json:"client"`
	BillingUnit       string               `json:"billingUnit"`
	Lines             []domain.InvoiceLine `json:"lines"`
	Subtotal          float64              `json:"subtotal"`
	VATAmount         float64              `json:"vatAmount"`
	WithholdingAmount float64              `json:"withholdingAmount"`
	GrandTotal        float64              `json:"grandTotal"`
	Notes             string               `json:"notes"`
	Currency          string               `json:"currency"`
	PDFFilename       string               `json:"pdfFilename,omitempty"`
	CreatedAt         string               `json:"createdAt"`
	UpdatedAt         string               `json:"updatedAt"`
}

func invoiceToResponse(invoice *domain.Invoice) InvoiceResponse {
	dueDate := ""
	if !invoice.DueDate.IsZero() {
		dueDate = invoice.DueDate.Format("2006-01-02")
	}

	return InvoiceResponse{
		ID:                invoice.ID.Hex(),
		ProfileID:         invoice.ProfileID,
		Number:            invoice.Number,
		Series:            invoice.Series,
		Sequence:          invoice.Sequence,
		IssueDate:         invoice.IssueDate.Format("2006-01-02"),
		DueDate:           dueDate,
		Status:            string(invoice.Status),
		Emitter:           invoice.Emitter,
		Client:            invoice.Client,
		BillingUnit:       string(invoice.BillingUnit),
		Lines:             invoice.Lines,
		Subtotal:          invoice.Subtotal,
		VATAmount:         invoice.VATAmount,
		WithholdingAmount: invoice.WithholdingAmount,
		GrandTotal:        invoice.GrandTotal,
		Notes:             invoice.Notes,
		Currency:          invoice.Currency,
		PDFFilename:       invoice.PDFFilename,
		CreatedAt:         invoice.CreatedAt.Format("2006-01-02"),
		UpdatedAt:         invoice.UpdatedAt.Format("2006-01-02"),
	}
}

// CreateInvoice handles POST /api/invoices
func (h *InvoiceHandler) CreateInvoice(c *gin.Context) {
	var invoice domain.Invoice
	if err := c.ShouldBindJSON(&invoice); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.CreateInvoice(c.Request.Context(), getProfileID(c), &invoice); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, invoiceToResponse(&invoice))
}

// GetInvoice handles GET /api/invoices/:id
func (h *InvoiceHandler) GetInvoice(c *gin.Context) {
	id := c.Param("id")

	invoice, err := h.service.GetInvoice(c.Request.Context(), getProfileID(c), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, invoiceToResponse(invoice))
}

// ListInvoices handles GET /api/invoices
func (h *InvoiceHandler) ListInvoices(c *gin.Context) {
	if h.scheduleService != nil {
		if err := h.scheduleService.GenerateDueInvoices(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	invoices, err := h.service.ListInvoices(c.Request.Context(), getProfileID(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	responses := make([]InvoiceResponse, len(invoices))
	for i, inv := range invoices {
		responses[i] = invoiceToResponse(&inv)
	}
	c.JSON(http.StatusOK, responses)
}

// UpdateInvoice handles PUT /api/invoices/:id
func (h *InvoiceHandler) UpdateInvoice(c *gin.Context) {
	id := c.Param("id")

	var updates domain.Invoice
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.UpdateInvoice(c.Request.Context(), getProfileID(c), id, &updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	invoice, _ := h.service.GetInvoice(c.Request.Context(), getProfileID(c), id)
	c.JSON(http.StatusOK, invoiceToResponse(invoice))
}

// DeleteInvoice handles DELETE /api/invoices/:id
func (h *InvoiceHandler) DeleteInvoice(c *gin.Context) {
	id := c.Param("id")

	if err := h.service.DeleteInvoice(c.Request.Context(), getProfileID(c), id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "invoice deleted"})
}

// DuplicateInvoice handles POST /api/invoices/:id/duplicate
func (h *InvoiceHandler) DuplicateInvoice(c *gin.Context) {
	id := c.Param("id")

	invoice, err := h.service.DuplicateInvoice(c.Request.Context(), getProfileID(c), id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, invoiceToResponse(invoice))
}

// GetInvoicePDF handles GET /api/invoices/:id/pdf
func (h *InvoiceHandler) GetInvoicePDF(c *gin.Context) {
	id := c.Param("id")

	path, filename, err := h.service.GetInvoicePDFPath(c.Request.Context(), getProfileID(c), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.File(path)
}

// DownloadInvoicePDF handles GET /api/invoices/:id/pdf/download
func (h *InvoiceHandler) DownloadInvoicePDF(c *gin.Context) {
	id := c.Param("id")

	path, filename, err := h.service.GetInvoicePDFPath(c.Request.Context(), getProfileID(c), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.File(path)
}
