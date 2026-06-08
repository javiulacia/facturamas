package services

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"facturamas-api/internal/domain"
	"github.com/go-pdf/fpdf"
)

const (
	pdfAccentR = 53
	pdfAccentG = 63
	pdfAccentB = 92
	pdfMutedR  = 120
	pdfMutedG  = 124
	pdfMutedB  = 133
	pdfLineR   = 227
	pdfLineG   = 229
	pdfLineB   = 232
)

type PDFService struct {
	outputDir string
	logoDir   string
}

func NewPDFService(outputDir string, logoDir string) *PDFService {
	os.MkdirAll(outputDir, 0755)
	os.MkdirAll(logoDir, 0755)
	return &PDFService{
		outputDir: outputDir,
		logoDir:   logoDir,
	}
}

func (s *PDFService) GenerateInvoicePDF(invoice *domain.Invoice) (string, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(14, 14, 14)
	pdf.SetAutoPageBreak(true, 16)
	pdf.AliasNbPages("{nb}")
	pdf.SetFooterFunc(func() {
		pdf.SetY(-10)
		pdf.SetTextColor(pdfMutedR, pdfMutedG, pdfMutedB)
		pdf.SetFont("Arial", "", 8)
		pdf.CellFormat(0, 4, fmt.Sprintf("%d/{nb}", pdf.PageNo()), "", 0, "R", false, 0, "")
	})
	pdf.AddPage()

	tr := pdf.UnicodeTranslatorFromDescriptor("")

	writeText := func(w, h float64, text string, border string, ln int, align string, fill bool) {
		pdf.CellFormat(w, h, tr(text), border, ln, align, fill, 0, "")
	}

	writeMultiline := func(w, h float64, text string, align string) {
		pdf.MultiCell(w, h, tr(text), "", align, false)
	}

	drawSectionTitle := func(title string) {
		pdf.SetTextColor(pdfMutedR, pdfMutedG, pdfMutedB)
		pdf.SetFont("Arial", "B", 8)
		writeText(0, 5, strings.ToUpper(title), "", 1, "", false)
		pdf.SetDrawColor(pdfLineR, pdfLineG, pdfLineB)
		y := pdf.GetY()
		pdf.Line(pdf.GetX(), y, 196, y)
		pdf.Ln(2)
	}

	writeBlockLines := func(x, y, w float64, title string, lines []string) float64 {
		pdf.SetXY(x, y)
		drawSectionTitle(title)
		pdf.SetTextColor(55, 55, 55)
		pdf.SetFont("Arial", "B", 9)
		pdf.SetX(x)
		writeText(w, 5, fallback(firstLine(lines), "-"), "", 1, "L", false)
		pdf.SetFont("Arial", "", 8.8)
		for _, line := range lines[1:] {
			pdf.SetX(x)
			writeMultiline(w, 4.5, line, "L")
		}
		return pdf.GetY()
	}

	detailsText := strings.TrimSpace(invoice.Notes)

	referenceLines := []string{
		fmt.Sprintf("Referencia de factura: %s", invoice.Number),
	}
	if invoice.Client.TaxID != "" {
		referenceLines = append(referenceLines, fmt.Sprintf("Referencia del cliente: %s", invoice.Client.TaxID))
	}
	referenceLines = append(referenceLines, fmt.Sprintf("Emitida el %s", invoice.IssueDate.Format("2 Jan 2006")))

	// Header
	logoBottomY := s.renderLogo(pdf, strings.TrimSpace(invoice.Emitter.LogoURL))

	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "B", 22)
	writeText(110, 10, "Factura", "", 1, "L", false)

	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(55, 55, 55)
	for _, line := range referenceLines {
		writeText(110, 6, line, "", 1, "L", false)
	}

	pdf.Ln(3)
	pdf.SetFont("Arial", "B", 10)
	pdf.SetTextColor(55, 55, 55)
	writeText(110, 7, fmt.Sprintf("Vencimiento: %s", formatDueDate(invoice.DueDate)), "", 1, "L", false)

	pdf.SetY(max(pdf.GetY(), max(54, logoBottomY+6)))

	// Parties
	leftX := 14.0
	rightX := 118.0
	blockY := pdf.GetY()
	blockWidth := 78.0

	leftLines := emitterLines(invoice.Emitter)
	rightLines := append([]string{fallback(invoice.Client.Name, "-")}, clientLines(invoice.Client)...)
	leftEndY := writeBlockLines(leftX, blockY, blockWidth, "Emisor", leftLines)
	rightEndY := writeBlockLines(rightX, blockY, blockWidth, "Facturar a", rightLines)

	pdf.SetY(max(leftEndY, rightEndY))
	pdf.Ln(8)

	// Project notes
	if detailsText != "" {
		drawSectionTitle("Notas del proyecto")
		pdf.SetTextColor(55, 55, 55)
		pdf.SetFont("Arial", "", 8.5)
		writeMultiline(0, 4.5, detailsText, "L")
		pdf.Ln(4)
	}

	// Table
	colDescription := 66.0
	colQty := 28.0
	colUnit := 42.0
	colTotal := 40.0

	pdf.SetTextColor(70, 70, 70)
	pdf.SetFont("Arial", "B", 8)
	writeText(colDescription, 6, "Descripcion", "", 0, "L", false)
	writeText(colQty, 6, billingUnitLabel(invoice.BillingUnit), "", 0, "L", false)
	writeText(colUnit, 6, "Precio unitario", "", 0, "R", false)
	writeText(colTotal, 6, "Total base", "", 1, "R", false)

	pdf.SetDrawColor(pdfLineR, pdfLineG, pdfLineB)
	y := pdf.GetY()
	pdf.Line(14, y, 196, y)
	pdf.Ln(2)

	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(55, 55, 55)
	for _, line := range invoice.Lines {
		writeText(colDescription, 8, line.Description, "", 0, "L", false)
		writeText(colQty, 8, formatQuantity(line.Quantity), "", 0, "L", false)
		writeText(colUnit, 8, formatPlainMoney(line.UnitPrice, invoice.Currency), "", 0, "R", false)
		writeText(colTotal, 8, formatPlainMoney(line.Subtotal, invoice.Currency), "", 1, "R", false)
	}

	pdf.Ln(2)
	y = pdf.GetY()
	pdf.Line(14, y, 196, y)
	pdf.Ln(6)

	// Totals
	labelW := 48.0
	valueW := 28.0
	pdf.SetX(120)
	pdf.SetTextColor(90, 90, 90)
	pdf.SetFont("Arial", "", 9)
	writeText(labelW, 7, "TOTAL (SIN IMPUESTOS)", "", 0, "L", false)
	pdf.SetFont("Arial", "B", 11)
	writeText(valueW, 7, formatPlainMoney(invoice.Subtotal, invoice.Currency), "", 1, "R", false)

	pdf.SetX(120)
	pdf.SetFont("Arial", "", 9)
	writeText(labelW, 7, fmt.Sprintf("IVA (%.0f%%)", vatPercent(invoice)), "", 0, "L", false)
	pdf.SetFont("Arial", "B", 11)
	writeText(valueW, 7, formatPlainMoney(invoice.VATAmount, invoice.Currency), "", 1, "R", false)

	if !isCompanyInvoice(invoice) {
		pdf.SetX(120)
		pdf.SetFont("Arial", "", 9)
		writeText(labelW, 7, fmt.Sprintf("IRPF (%.0f%%)", withholdingPercent(invoice)), "", 0, "L", false)
		pdf.SetFont("Arial", "B", 11)
		writeText(valueW, 7, formatSignedMoney(-invoice.WithholdingAmount, invoice.Currency), "", 1, "R", false)
	}

	pdf.SetDrawColor(pdfLineR, pdfLineG, pdfLineB)
	y = pdf.GetY()
	pdf.Line(120, y, 196, y)
	pdf.Ln(4)

	pdf.SetX(120)
	pdf.SetTextColor(80, 80, 80)
	pdf.SetFont("Arial", "B", 10)
	writeText(labelW, 8, "TOTAL", "", 0, "L", false)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFont("Arial", "B", 16)
	writeText(valueW, 8, formatPlainMoney(invoice.GrandTotal, invoice.Currency), "", 1, "R", false)

	// Footer / payment info
	pdf.SetY(max(pdf.GetY()+18, 238))
	pdf.SetTextColor(95, 95, 95)
	pdf.SetFont("Arial", "", 7.5)
	writeMultiline(0, 3.8, paymentSummary(invoice), "L")

	filename := fmt.Sprintf("invoice_%s.pdf", invoice.ID.Hex())
	outputPath := filepath.Join(s.outputDir, filename)
	if err := pdf.OutputFileAndClose(outputPath); err != nil {
		return "", err
	}

	return filename, nil
}

func (s *PDFService) GetPDFPath(filename string) string {
	return filepath.Join(s.outputDir, filename)
}

func (s *PDFService) RemovePDF(filename string) error {
	if filename == "" {
		return nil
	}

	err := os.Remove(s.GetPDFPath(filename))
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	return nil
}

func partyLines(name, address, taxID, email, phone string, isEmitter bool) []string {
	lines := []string{fallback(name, "-")}
	if taxID != "" {
		lines = append(lines, fmt.Sprintf("NIF/CIF: %s", taxID))
	}
	lines = append(lines, splitNonEmpty(address)...)
	if email != "" {
		lines = append(lines, fmt.Sprintf("Email: %s", email))
	}
	if isEmitter && phone != "" {
		lines = append(lines, fmt.Sprintf("Telefono: %s", phone))
	}
	return lines
}

func emitterLines(emitter domain.EmitterData) []string {
	lines := []string{fallback(emitter.Name, "-")}
	if emitter.TaxID != "" {
		lines = append(lines, fmt.Sprintf("NIF/CIF: %s", emitter.TaxID))
	}
	lines = append(lines, splitNonEmpty(formatEmitterAddress(emitter))...)
	if emitter.Email != "" {
		lines = append(lines, fmt.Sprintf("Email: %s", emitter.Email))
	}
	if emitter.Phone != "" {
		lines = append(lines, fmt.Sprintf("Telefono: %s", emitter.Phone))
	}
	return lines
}

func clientLines(client domain.ClientData) []string {
	if client.TaxID != "" {
		lines := []string{fmt.Sprintf("NIF/CIF: %s", client.TaxID)}
		lines = append(lines, splitNonEmpty(formatClientAddress(client))...)
		if client.Email != "" {
			lines = append(lines, fmt.Sprintf("Contacto: %s", client.Email))
		}
		return lines
	}
	lines := splitNonEmpty(formatClientAddress(client))
	if client.Email != "" {
		lines = append(lines, fmt.Sprintf("Contacto: %s", client.Email))
	}
	return lines
}

func formatClientAddress(client domain.ClientData) string {
	parts := []string{}
	if strings.TrimSpace(client.Address) != "" {
		parts = append(parts, strings.TrimSpace(client.Address))
	}

	location := strings.TrimSpace(strings.Join([]string{
		strings.TrimSpace(client.PostalCode),
		strings.TrimSpace(client.City),
	}, " "))
	if location != "" {
		parts = append(parts, location)
	}

	if strings.TrimSpace(client.Country) != "" {
		parts = append(parts, strings.TrimSpace(client.Country))
	}

	return strings.Join(parts, "\n")
}

func formatEmitterAddress(emitter domain.EmitterData) string {
	parts := []string{}
	if strings.TrimSpace(emitter.Address) != "" {
		parts = append(parts, strings.TrimSpace(emitter.Address))
	}

	location := strings.TrimSpace(strings.Join([]string{
		strings.TrimSpace(emitter.PostalCode),
		strings.TrimSpace(emitter.City),
	}, " "))
	if location != "" {
		parts = append(parts, location)
	}

	if strings.TrimSpace(emitter.Country) != "" {
		parts = append(parts, strings.TrimSpace(emitter.Country))
	}

	return strings.Join(parts, "\n")
}

func splitNonEmpty(value string) []string {
	raw := strings.Split(value, "\n")
	lines := make([]string, 0, len(raw))
	for _, line := range raw {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			lines = append(lines, trimmed)
		}
	}
	return lines
}

func firstLine(lines []string) string {
	if len(lines) == 0 {
		return ""
	}
	return lines[0]
}

func formatDueDate(dueDate time.Time) string {
	if dueDate.IsZero() {
		return "-"
	}
	return dueDate.Format("2 Jan 2006")
}

func billingUnitLabel(unit domain.BillingUnit) string {
	if unit == domain.BillingUnitDays {
		return "Dias"
	}
	if unit == domain.BillingUnitService {
		return "Servicio"
	}
	return "Horas"
}

func formatQuantity(value float64) string {
	if value == float64(int64(value)) {
		return fmt.Sprintf("%.0f", value)
	}
	return fmt.Sprintf("%.2f", value)
}

func formatPlainMoney(amount float64, currency string) string {
	symbol := currency
	if currency == "EUR" {
		symbol = "EUR"
	}
	return fmt.Sprintf("%s%.2f %s", amountPrefix(amount), abs(amount), symbol)
}

func formatSignedMoney(amount float64, currency string) string {
	return formatPlainMoney(amount, currency)
}

func amountPrefix(amount float64) string {
	if amount < 0 {
		return "-"
	}
	return ""
}

func abs(value float64) float64 {
	if value < 0 {
		return -value
	}
	return value
}

func withholdingPercent(invoice *domain.Invoice) float64 {
	if len(invoice.Lines) == 0 {
		return 0
	}
	return invoice.Lines[0].Withholding
}

func vatPercent(invoice *domain.Invoice) float64 {
	if len(invoice.Lines) == 0 {
		return 0
	}
	return invoice.Lines[0].VAT
}

func paymentSummary(invoice *domain.Invoice) string {
	lines := []string{
		"Para pagar por transferencia bancaria, utiliza los datos indicados a continuacion",
		fmt.Sprintf("e incluye como referencia la factura: %s", invoice.Number),
		"",
		fmt.Sprintf("Beneficiario: %s", fallback(invoice.Emitter.Name, "-")),
	}
	if invoice.Emitter.IBAN != "" {
		lines = append(lines, fmt.Sprintf("IBAN: %s", invoice.Emitter.IBAN))
	}
	if invoice.Emitter.TaxID != "" {
		lines = append(lines, fmt.Sprintf("Referencia fiscal / NIF: %s", invoice.Emitter.TaxID))
	}
	return strings.Join(lines, "\n")
}

func isCompanyInvoice(invoice *domain.Invoice) bool {
	return strings.TrimSpace(invoice.Emitter.ProfileType) == string(domain.ProfileTypeCompany)
}

func (s *PDFService) renderLogo(pdf *fpdf.Fpdf, logoURL string) float64 {
	if logoURL == "" {
		return 0
	}

	imageData, imageType, err := s.fetchLogoImage(logoURL)
	if err != nil {
		return 0
	}

	imageName := fmt.Sprintf("remote-logo-%d", time.Now().UnixNano())
	info := pdf.RegisterImageOptionsReader(imageName, fpdf.ImageOptions{
		ImageType: imageType,
		ReadDpi:   true,
	}, bytes.NewReader(imageData))
	if info == nil {
		return 0
	}

	width, height := info.Extent()
	if width == 0 || height == 0 {
		return 0
	}

	maxWidth := 42.0
	maxHeight := 20.0
	scale := min(maxWidth/width, maxHeight/height)
	if scale > 1 {
		scale = 1
	}

	drawWidth := width * scale
	drawHeight := height * scale
	x := 196.0 - drawWidth
	y := 14.0
	pdf.ImageOptions(imageName, x, y, drawWidth, drawHeight, false, fpdf.ImageOptions{
		ImageType: imageType,
		ReadDpi:   true,
	}, 0, "")

	return y + drawHeight
}

func (s *PDFService) fetchLogoImage(logoURL string) ([]byte, string, error) {
	if strings.HasPrefix(strings.TrimSpace(logoURL), logoAssetURLPrefix) {
		filename := filepath.Base(strings.TrimPrefix(strings.TrimSpace(logoURL), logoAssetURLPrefix))
		localPath := filepath.Join(s.logoDir, filename)
		data, err := os.ReadFile(localPath)
		if err != nil {
			return nil, "", err
		}
		imageType := imageTypeFromURL(localPath)
		if imageType == "" {
			return nil, "", fmt.Errorf("unsupported local logo image type")
		}
		return data, imageType, nil
	}

	req, err := http.NewRequest(http.MethodGet, logoURL, nil)
	if err != nil {
		return nil, "", err
	}

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("logo request failed with status %d", resp.StatusCode)
	}

	imageType := imageTypeFromContentType(resp.Header.Get("Content-Type"))
	if imageType == "" {
		imageType = imageTypeFromURL(logoURL)
	}
	if imageType == "" {
		return nil, "", fmt.Errorf("unsupported logo content type")
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	return data, imageType, nil
}

func imageTypeFromContentType(contentType string) string {
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	switch contentType {
	case "image/png":
		return "png"
	case "image/jpeg", "image/jpg":
		return "jpg"
	case "image/gif":
		return "gif"
	default:
		return ""
	}
}

func imageTypeFromURL(rawURL string) string {
	lowerURL := strings.ToLower(rawURL)
	switch {
	case strings.Contains(lowerURL, ".png"):
		return "png"
	case strings.Contains(lowerURL, ".jpg"), strings.Contains(lowerURL, ".jpeg"):
		return "jpg"
	case strings.Contains(lowerURL, ".gif"):
		return "gif"
	default:
		return ""
	}
}

func formatSpanishMonth(date time.Time) string {
	months := []string{
		"enero",
		"febrero",
		"marzo",
		"abril",
		"mayo",
		"junio",
		"julio",
		"agosto",
		"septiembre",
		"octubre",
		"noviembre",
		"diciembre",
	}

	month := months[int(date.Month())-1]
	return fmt.Sprintf("%s %d", strings.Title(month), date.Year())
}

func fallback(value, alt string) string {
	if strings.TrimSpace(value) == "" {
		return alt
	}
	return value
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
