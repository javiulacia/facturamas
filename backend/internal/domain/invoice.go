package domain

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// InvoiceStatus represents the state of an invoice
type InvoiceStatus string

type BudgetStatus string
type BillingUnit string
type ProfileType string
type InvoiceScheduleFrequency string

const (
	InvoiceDraft  InvoiceStatus = "draft"
	InvoiceIssued InvoiceStatus = "issued"
	InvoicePaid   InvoiceStatus = "paid"

	BudgetDraft     BudgetStatus = "draft"
	BudgetSent      BudgetStatus = "sent"
	BudgetAccepted  BudgetStatus = "accepted"
	BudgetRejected  BudgetStatus = "rejected"
	BudgetConverted BudgetStatus = "converted"

	BillingUnitHours   BillingUnit = "hours"
	BillingUnitDays    BillingUnit = "days"
	BillingUnitService BillingUnit = "service"

	ProfileTypeSelfEmployed ProfileType = "self_employed"
	ProfileTypeCompany      ProfileType = "company"

	InvoiceScheduleWeekly  InvoiceScheduleFrequency = "weekly"
	InvoiceScheduleMonthly InvoiceScheduleFrequency = "monthly"
)

// InvoiceLine represents a single line item in an invoice
type InvoiceLine struct {
	Description       string  `bson:"description" json:"description"`
	Quantity          float64 `bson:"quantity" json:"quantity"`
	UnitPrice         float64 `bson:"unitPrice" json:"unitPrice"`
	VAT               float64 `bson:"vat" json:"vat"`                             // % VAT
	Withholding       float64 `bson:"withholding" json:"withholding"`             // % IRPF
	Subtotal          float64 `bson:"subtotal" json:"subtotal"`                   // quantity * unitPrice
	VATAmount         float64 `bson:"vatAmount" json:"vatAmount"`                 // subtotal * VAT / 100
	WithholdingAmount float64 `bson:"withholdingAmount" json:"withholdingAmount"` // subtotal * Withholding / 100
	LineTotal         float64 `bson:"lineTotal" json:"lineTotal"`                 // subtotal + vatAmount - withholdingAmount
}

// ClientData represents invoice recipient data
type ClientData struct {
	ID         string `bson:"id,omitempty" json:"id,omitempty"`
	Name       string `bson:"name" json:"name"`
	TaxID      string `bson:"taxId" json:"taxId"`
	Address    string `bson:"address" json:"address"`
	City       string `bson:"city" json:"city"`
	PostalCode string `bson:"postalCode" json:"postalCode"`
	Country    string `bson:"country" json:"country"`
	Email      string `bson:"email" json:"email"`
}

// Client represents a reusable client entry stored independently from invoices.
type Client struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	ProfileID  string             `bson:"profileId" json:"profileId"`
	Name       string             `bson:"name" json:"name"`
	TaxID      string             `bson:"taxId" json:"taxId"`
	Address    string             `bson:"address" json:"address"`
	City       string             `bson:"city" json:"city"`
	PostalCode string             `bson:"postalCode" json:"postalCode"`
	Country    string             `bson:"country" json:"country"`
	Email      string             `bson:"email" json:"email"`
	CreatedAt  time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt  time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// Contact represents a reusable business contact stored independently from invoices.
type Contact struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	ProfileID string             `bson:"profileId" json:"profileId"`
	Company   string             `bson:"company" json:"company"`
	Name      string             `bson:"name" json:"name"`
	Role      string             `bson:"role" json:"role"`
	Phone     string             `bson:"phone" json:"phone"`
	Email     string             `bson:"email" json:"email"`
	CreatedAt time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// EmitterData is a snapshot of emitter settings at invoice time
type EmitterData struct {
	ProfileID          string  `bson:"profileId,omitempty" json:"profileId,omitempty"`
	ProfileName        string  `bson:"profileName,omitempty" json:"profileName,omitempty"`
	ProfileType        string  `bson:"profileType,omitempty" json:"profileType,omitempty"`
	Name               string  `bson:"name" json:"name"`
	TaxID              string  `bson:"taxId" json:"taxId"`
	Address            string  `bson:"address" json:"address"`
	City               string  `bson:"city" json:"city"`
	PostalCode         string  `bson:"postalCode" json:"postalCode"`
	Country            string  `bson:"country" json:"country"`
	Email              string  `bson:"email" json:"email"`
	Phone              string  `bson:"phone" json:"phone"`
	IBAN               string  `bson:"iban" json:"iban"`
	LogoURL            string  `bson:"logoUrl" json:"logoUrl"`
	DefaultCurrency    string  `bson:"defaultCurrency" json:"defaultCurrency"`
	DefaultVAT         float64 `bson:"defaultVat" json:"defaultVat"`
	DefaultWithholding float64 `bson:"defaultWithholding" json:"defaultWithholding"`
}

// Invoice represents a complete invoice document
type Invoice struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	ProfileID         string             `bson:"profileId" json:"profileId"`
	Number            string             `bson:"number" json:"number"`
	Series            string             `bson:"series" json:"series"`
	Sequence          int64              `bson:"sequence" json:"sequence"`
	IssueDate         time.Time          `bson:"issueDate" json:"issueDate"`
	DueDate           time.Time          `bson:"dueDate" json:"dueDate"`
	Status            InvoiceStatus      `bson:"status" json:"status"`
	Emitter           EmitterData        `bson:"emitter" json:"emitter"`
	Client            ClientData         `bson:"client" json:"client"`
	BillingUnit       BillingUnit        `bson:"billingUnit" json:"billingUnit"`
	Lines             []InvoiceLine      `bson:"lines" json:"lines"`
	Subtotal          float64            `bson:"subtotal" json:"subtotal"`
	VATAmount         float64            `bson:"vatAmount" json:"vatAmount"`
	WithholdingAmount float64            `bson:"withholdingAmount" json:"withholdingAmount"`
	GrandTotal        float64            `bson:"grandTotal" json:"grandTotal"`
	Notes             string             `bson:"notes" json:"notes"`
	Currency          string             `bson:"currency" json:"currency"`
	PDFFilename       string             `bson:"pdfFilename,omitempty" json:"pdfFilename,omitempty"`
	CreatedAt         time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt         time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type Budget struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	ProfileID          string             `bson:"profileId" json:"profileId"`
	Number             string             `bson:"number" json:"number"`
	Series             string             `bson:"series" json:"series"`
	Sequence           int64              `bson:"sequence" json:"sequence"`
	IssueDate          time.Time          `bson:"issueDate" json:"issueDate"`
	ValidUntil         time.Time          `bson:"validUntil" json:"validUntil"`
	Status             BudgetStatus       `bson:"status" json:"status"`
	Emitter            EmitterData        `bson:"emitter" json:"emitter"`
	Client             ClientData         `bson:"client" json:"client"`
	BillingUnit        BillingUnit        `bson:"billingUnit" json:"billingUnit"`
	Lines              []InvoiceLine      `bson:"lines" json:"lines"`
	Subtotal           float64            `bson:"subtotal" json:"subtotal"`
	VATAmount          float64            `bson:"vatAmount" json:"vatAmount"`
	WithholdingAmount  float64            `bson:"withholdingAmount" json:"withholdingAmount"`
	GrandTotal         float64            `bson:"grandTotal" json:"grandTotal"`
	Notes              string             `bson:"notes" json:"notes"`
	Currency           string             `bson:"currency" json:"currency"`
	ConvertedInvoiceID string             `bson:"convertedInvoiceId,omitempty" json:"convertedInvoiceId,omitempty"`
	ConvertedAt        time.Time          `bson:"convertedAt,omitempty" json:"convertedAt,omitempty"`
	CreatedAt          time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt          time.Time          `bson:"updatedAt" json:"updatedAt"`
}

type InvoiceSchedule struct {
	ID          primitive.ObjectID       `bson:"_id,omitempty" json:"id,omitempty"`
	ProfileID   string                   `bson:"profileId" json:"profileId"`
	Name        string                   `bson:"name" json:"name"`
	Client      ClientData               `bson:"client" json:"client"`
	BillingUnit BillingUnit              `bson:"billingUnit" json:"billingUnit"`
	Lines       []InvoiceLine            `bson:"lines" json:"lines"`
	Notes       string                   `bson:"notes" json:"notes"`
	Currency    string                   `bson:"currency" json:"currency"`
	Status      InvoiceStatus            `bson:"status" json:"status"`
	Frequency   InvoiceScheduleFrequency `bson:"frequency" json:"frequency"`
	Interval    int                      `bson:"interval" json:"interval"`
	StartDate   time.Time                `bson:"startDate" json:"startDate"`
	NextRunDate time.Time                `bson:"nextRunDate" json:"nextRunDate"`
	EndDate     time.Time                `bson:"endDate,omitempty" json:"endDate,omitempty"`
	DueDays     int                      `bson:"dueDays" json:"dueDays"`
	LastRunAt   time.Time                `bson:"lastRunAt,omitempty" json:"lastRunAt,omitempty"`
	Active      bool                     `bson:"active" json:"active"`
	CreatedAt   time.Time                `bson:"createdAt" json:"createdAt"`
	UpdatedAt   time.Time                `bson:"updatedAt" json:"updatedAt"`
}

// Profile represents a billing entity with its own defaults and numbering.
type Profile struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Key                string             `bson:"key" json:"key"`
	Type               ProfileType        `bson:"type" json:"type"`
	IsDefault          bool               `bson:"isDefault" json:"isDefault"`
	Name               string             `bson:"name" json:"name"`
	TaxID              string             `bson:"taxId" json:"taxId"`
	Address            string             `bson:"address" json:"address"`
	City               string             `bson:"city" json:"city"`
	PostalCode         string             `bson:"postalCode" json:"postalCode"`
	Country            string             `bson:"country" json:"country"`
	Email              string             `bson:"email" json:"email"`
	Phone              string             `bson:"phone" json:"phone"`
	IBAN               string             `bson:"iban" json:"iban"`
	LogoURL            string             `bson:"logoUrl" json:"logoUrl"`
	DefaultCurrency    string             `bson:"defaultCurrency" json:"defaultCurrency"`
	DefaultVAT         float64            `bson:"defaultVat" json:"defaultVat"`
	DefaultWithholding float64            `bson:"defaultWithholding" json:"defaultWithholding"`
	DefaultSeries      string             `bson:"defaultSeries" json:"defaultSeries"`
	SequenceCounter    int64              `bson:"sequenceCounter" json:"sequenceCounter"`
	CreatedAt          time.Time          `bson:"createdAt" json:"createdAt"`
	UpdatedAt          time.Time          `bson:"updatedAt" json:"updatedAt"`
}

// Settings is kept as an alias for the active billing profile to avoid
// changing the existing settings UI contract.
type Settings = Profile

// InvoiceRepository defines invoice persistence operations
type InvoiceRepository interface {
	Create(ctx context.Context, invoice *Invoice) error
	GetByID(ctx context.Context, profileID string, id string) (*Invoice, error)
	GetAll(ctx context.Context, profileID string) ([]Invoice, error)
	GetUsedSequencesBySeries(ctx context.Context, profileID string, series string) ([]int64, error)
	ReplaceAll(ctx context.Context, invoices []Invoice) error
	Update(ctx context.Context, id string, invoice *Invoice) error
	Delete(ctx context.Context, id string) error
	DeleteAll(ctx context.Context, profileID string) error
}

type BudgetRepository interface {
	Create(ctx context.Context, budget *Budget) error
	GetByID(ctx context.Context, profileID string, id string) (*Budget, error)
	GetAll(ctx context.Context, profileID string) ([]Budget, error)
	GetUsedSequencesBySeries(ctx context.Context, profileID string, series string) ([]int64, error)
	ReplaceAll(ctx context.Context, budgets []Budget) error
	Update(ctx context.Context, id string, budget *Budget) error
	Delete(ctx context.Context, id string) error
	DeleteAll(ctx context.Context, profileID string) error
}

// ClientRepository defines client persistence operations.
type ClientRepository interface {
	Create(ctx context.Context, client *Client) error
	GetByID(ctx context.Context, profileID string, id string) (*Client, error)
	GetAll(ctx context.Context, profileID string) ([]Client, error)
	ReplaceAll(ctx context.Context, clients []Client) error
	Update(ctx context.Context, id string, client *Client) error
	Delete(ctx context.Context, id string) error
	DeleteAll(ctx context.Context, profileID string) error
}

// ContactRepository defines contact persistence operations.
type ContactRepository interface {
	Create(ctx context.Context, contact *Contact) error
	CreateMany(ctx context.Context, contacts []Contact) error
	Count(ctx context.Context, profileID string) (int64, error)
	GetByID(ctx context.Context, profileID string, id string) (*Contact, error)
	GetAll(ctx context.Context, profileID string) ([]Contact, error)
	ReplaceAll(ctx context.Context, contacts []Contact) error
	Update(ctx context.Context, id string, contact *Contact) error
	Delete(ctx context.Context, id string) error
	DeleteAll(ctx context.Context, profileID string) error
}

type ProfileRepository interface {
	GetDefault(ctx context.Context) (*Profile, error)
	GetByID(ctx context.Context, id string) (*Profile, error)
	GetByKey(ctx context.Context, key string) (*Profile, error)
	GetAll(ctx context.Context) ([]Profile, error)
	ReplaceAll(ctx context.Context, profiles []Profile) error
	Update(ctx context.Context, id string, profile *Profile) error
}

type InvoiceScheduleRepository interface {
	Create(ctx context.Context, schedule *InvoiceSchedule) error
	GetByID(ctx context.Context, profileID string, id string) (*InvoiceSchedule, error)
	GetAll(ctx context.Context, profileID string) ([]InvoiceSchedule, error)
	GetDueSchedules(ctx context.Context, now time.Time) ([]InvoiceSchedule, error)
	Update(ctx context.Context, id string, schedule *InvoiceSchedule) error
	Delete(ctx context.Context, id string) error
}

type BackupData struct {
	Version    int       `json:"version"`
	ExportedAt time.Time `json:"exportedAt"`
	Settings   Settings  `json:"settings"`
	Profiles   []Profile `json:"profiles"`
	Clients    []Client  `json:"clients"`
	Contacts   []Contact `json:"contacts"`
	Invoices   []Invoice `json:"invoices"`
	Budgets    []Budget  `json:"budgets"`
}
