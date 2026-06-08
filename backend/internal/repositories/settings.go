package repositories

import (
	"context"
	"errors"
	"time"

	"facturamas-api/internal/domain"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoSettingsRepository struct {
	collection *mongo.Collection
}

func NewMongoSettingsRepository(db *mongo.Database) *MongoSettingsRepository {
	return &MongoSettingsRepository{
		collection: db.Collection("settings"),
	}
}

func (r *MongoSettingsRepository) Get(ctx context.Context) (*domain.Settings, error) {
	result := &domain.Settings{}
	err := r.collection.FindOne(ctx, bson.M{}).Decode(result)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			// Return default settings if none exist
			return &domain.Settings{
				DefaultCurrency:    "EUR",
				DefaultVAT:         21.0,
				DefaultWithholding: 15.0,
				DefaultSeries:      "2026",
				SequenceCounter:    0,
			}, nil
		}
		return nil, err
	}
	return result, nil
}

func (r *MongoSettingsRepository) Update(ctx context.Context, settings *domain.Settings) error {
	settings.UpdatedAt = time.Now()
	opts := options.Update().SetUpsert(true)

	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{},
		bson.M{"$set": settings},
		opts,
	)
	return err
}

func (r *MongoSettingsRepository) DeleteAll(ctx context.Context) error {
	_, err := r.collection.DeleteMany(ctx, bson.M{})
	return err
}
