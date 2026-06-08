package config

import (
	"context"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Config holds the application configuration
type Config struct {
	MongoURI   string
	DBName     string
	ServerPort string
	PDFDir     string
	LogoDir    string
}

// NewConfig creates a new configuration from environment variables
func NewConfig() *Config {
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://mongo:27017"
	}

	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "facturamas"
	}

	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "3000"
	}

	pdfDir := os.Getenv("PDF_OUTPUT_DIR")
	if pdfDir == "" {
		pdfDir = "storage/pdfs"
	}

	logoDir := os.Getenv("LOGO_STORAGE_DIR")
	if logoDir == "" {
		logoDir = "storage/logos"
	}

	return &Config{
		MongoURI:   mongoURI,
		DBName:     dbName,
		ServerPort: port,
		PDFDir:     pdfDir,
		LogoDir:    logoDir,
	}
}

// NewMongoDB establishes a connection to MongoDB and returns the database instance
func NewMongoDB(cfg *Config) (*mongo.Database, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		return nil, err
	}

	// Verify connection
	err = client.Ping(ctx, nil)
	if err != nil {
		return nil, err
	}

	return client.Database(cfg.DBName), nil
}
