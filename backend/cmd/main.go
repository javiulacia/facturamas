package main

import (
	"context"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"facturamas-api/internal/config"
	"facturamas-api/internal/handlers"
	"facturamas-api/internal/middleware"
	"facturamas-api/internal/repositories"
	"facturamas-api/internal/services"
)

func main() {
	// Load environment variables
	_ = godotenv.Load()

	// Initialize configuration
	cfg := config.NewConfig()

	// Initialize MongoDB
	db, err := config.NewMongoDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	// Initialize repositories
	invoiceRepo := repositories.NewMongoInvoiceRepository(db)
	budgetRepo := repositories.NewMongoBudgetRepository(db)
	scheduleRepo := repositories.NewMongoInvoiceScheduleRepository(db)
	profileRepo := repositories.NewMongoProfileRepository(db)
	clientRepo := repositories.NewMongoClientRepository(db)
	contactRepo := repositories.NewMongoContactRepository(db)

	// Initialize services
	profileService := services.NewProfileService(profileRepo)
	if err := profileService.EnsureBaseProfiles(context.Background()); err != nil {
		log.Fatalf("Failed to initialize profiles: %v", err)
	}
	logoAssetService := services.NewLogoAssetService(cfg.LogoDir)
	pdfService := services.NewPDFService(cfg.PDFDir, cfg.LogoDir)
	invoiceService := services.NewInvoiceService(invoiceRepo, profileRepo, profileService, pdfService)
	budgetService := services.NewBudgetService(budgetRepo, profileService, invoiceService)
	invoiceScheduleService := services.NewInvoiceScheduleService(scheduleRepo, profileService, invoiceService)
	settingsService := services.NewSettingsService(profileService, profileRepo, invoiceRepo, budgetRepo, clientRepo, contactRepo, logoAssetService)
	clientService := services.NewClientService(clientRepo, profileService)
	contactService := services.NewContactService(contactRepo, profileService)
	if err := invoiceScheduleService.GenerateDueInvoices(context.Background()); err != nil {
		log.Fatalf("Failed to generate due scheduled invoices: %v", err)
	}

	// Initialize handlers
	invoiceHandler := handlers.NewInvoiceHandler(invoiceService, invoiceScheduleService)
	budgetHandler := handlers.NewBudgetHandler(budgetService)
	invoiceScheduleHandler := handlers.NewInvoiceScheduleHandler(invoiceScheduleService)
	settingsHandler := handlers.NewSettingsHandler(settingsService)
	profileHandler := handlers.NewProfileHandler(profileService)
	clientHandler := handlers.NewClientHandler(clientService)
	contactHandler := handlers.NewContactHandler(contactService)
	logoAssetHandler := handlers.NewLogoAssetHandler(logoAssetService)

	// Create Gin router
	router := gin.Default()

	// Apply CORS middleware FIRST
	router.Use(middleware.CORS())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "OK"})
	})

	// Settings routes
	api := router.Group("/api")
	{
		api.GET("/profiles", profileHandler.ListProfiles)
		api.GET("/profiles/:id", profileHandler.GetProfile)
		api.PUT("/profiles/:id", profileHandler.UpdateProfile)
		api.GET("/assets/logos/:filename", logoAssetHandler.GetLogo)

		api.GET("/settings", settingsHandler.GetSettings)
		api.GET("/settings/backup", settingsHandler.ExportBackup)
		api.PUT("/settings", settingsHandler.UpdateSettings)
		api.POST("/settings/import-backup", settingsHandler.ImportBackup)
		api.POST("/settings/sync-profiles", settingsHandler.SyncProfiles)
		api.POST("/settings/reset-invoices", settingsHandler.ResetInvoices)
		api.POST("/settings/reset-clients", settingsHandler.ResetClients)
		api.POST("/settings/reset-contacts", settingsHandler.ResetContacts)
	}

	// Clients routes
	{
		clients := api.Group("/clients")
		clients.POST("", clientHandler.CreateClient)
		clients.GET("", clientHandler.ListClients)
		clients.GET("/:id", clientHandler.GetClient)
		clients.PUT("/:id", clientHandler.UpdateClient)
		clients.DELETE("/:id", clientHandler.DeleteClient)
	}

	// Contacts routes
	{
		contacts := api.Group("/contacts")
		contacts.POST("", contactHandler.CreateContact)
		contacts.GET("", contactHandler.ListContacts)
		contacts.GET("/:id", contactHandler.GetContact)
		contacts.PUT("/:id", contactHandler.UpdateContact)
		contacts.DELETE("/:id", contactHandler.DeleteContact)
	}

	// Invoices routes
	{
		invoices := api.Group("/invoices")
		invoices.POST("", invoiceHandler.CreateInvoice)
		invoices.GET("", invoiceHandler.ListInvoices)
		invoices.GET("/:id", invoiceHandler.GetInvoice)
		invoices.GET("/:id/pdf", invoiceHandler.GetInvoicePDF)
		invoices.GET("/:id/pdf/download", invoiceHandler.DownloadInvoicePDF)
		invoices.PUT("/:id", invoiceHandler.UpdateInvoice)
		invoices.DELETE("/:id", invoiceHandler.DeleteInvoice)
		invoices.POST("/:id/duplicate", invoiceHandler.DuplicateInvoice)
	}

	{
		budgets := api.Group("/budgets")
		budgets.POST("", budgetHandler.CreateBudget)
		budgets.GET("", budgetHandler.ListBudgets)
		budgets.POST("/:id/duplicate", budgetHandler.DuplicateBudget)
		budgets.POST("/:id/convert-to-invoice", budgetHandler.ConvertBudgetToInvoice)
		budgets.GET("/:id", budgetHandler.GetBudget)
		budgets.PUT("/:id", budgetHandler.UpdateBudget)
		budgets.DELETE("/:id", budgetHandler.DeleteBudget)
	}

	{
		schedules := api.Group("/invoice-schedules")
		schedules.POST("", invoiceScheduleHandler.CreateSchedule)
		schedules.GET("", invoiceScheduleHandler.ListSchedules)
		schedules.POST("/:id/generate-due", invoiceScheduleHandler.GenerateDueInvoices)
		schedules.GET("/:id", invoiceScheduleHandler.GetSchedule)
		schedules.PUT("/:id", invoiceScheduleHandler.UpdateSchedule)
		schedules.DELETE("/:id", invoiceScheduleHandler.DeleteSchedule)
	}

	// Start server
	port := ":" + cfg.ServerPort
	log.Printf("🚀 Server running on http://localhost%s", port)
	if err := router.Run(port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
