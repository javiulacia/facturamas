package repositories

import (
	"context"
	"errors"
	"time"

	"facturamas-api/internal/domain"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoProfileRepository struct {
	collection *mongo.Collection
}

func NewMongoProfileRepository(db *mongo.Database) *MongoProfileRepository {
	return &MongoProfileRepository{
		collection: db.Collection("profiles"),
	}
}

func (r *MongoProfileRepository) GetDefault(ctx context.Context) (*domain.Profile, error) {
	profile := &domain.Profile{}
	err := r.collection.FindOne(
		ctx,
		bson.M{},
		options.FindOne().SetSort(bson.D{{Key: "isDefault", Value: -1}, {Key: "createdAt", Value: 1}}),
	).Decode(profile)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("profile not found")
		}
		return nil, err
	}
	return profile, nil
}

func (r *MongoProfileRepository) GetByID(ctx context.Context, id string) (*domain.Profile, error) {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	profile := &domain.Profile{}
	err = r.collection.FindOne(ctx, bson.M{"_id": objectID}).Decode(profile)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("profile not found")
		}
		return nil, err
	}

	return profile, nil
}

func (r *MongoProfileRepository) GetByKey(ctx context.Context, key string) (*domain.Profile, error) {
	profile := &domain.Profile{}
	err := r.collection.FindOne(ctx, bson.M{"key": key}).Decode(profile)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("profile not found")
		}
		return nil, err
	}

	return profile, nil
}

func (r *MongoProfileRepository) GetAll(ctx context.Context) ([]domain.Profile, error) {
	cursor, err := r.collection.Find(
		ctx,
		bson.M{},
		options.Find().SetSort(bson.D{{Key: "isDefault", Value: -1}, {Key: "createdAt", Value: 1}}),
	)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var profiles []domain.Profile
	if err := cursor.All(ctx, &profiles); err != nil {
		return nil, err
	}
	if profiles == nil {
		profiles = []domain.Profile{}
	}

	return profiles, nil
}

func (r *MongoProfileRepository) ReplaceAll(ctx context.Context, profiles []domain.Profile) error {
	if _, err := r.collection.DeleteMany(ctx, bson.M{}); err != nil {
		return err
	}

	if len(profiles) == 0 {
		return nil
	}

	now := time.Now()
	docs := make([]interface{}, 0, len(profiles))
	for i := range profiles {
		if profiles[i].ID.IsZero() {
			profiles[i].ID = primitive.NewObjectID()
		}
		if profiles[i].CreatedAt.IsZero() {
			profiles[i].CreatedAt = now
		}
		if profiles[i].UpdatedAt.IsZero() {
			profiles[i].UpdatedAt = profiles[i].CreatedAt
		}
		docs = append(docs, profiles[i])
	}

	_, err := r.collection.InsertMany(ctx, docs)
	return err
}

func (r *MongoProfileRepository) Update(ctx context.Context, id string, profile *domain.Profile) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	profile.UpdatedAt = time.Now()
	if profile.CreatedAt.IsZero() {
		profile.CreatedAt = profile.UpdatedAt
	}

	_, err = r.collection.UpdateOne(
		ctx,
		bson.M{"_id": objectID},
		bson.M{"$set": profile},
		options.Update().SetUpsert(true),
	)
	return err
}
