package repositories

import (
	"context"
	"errors"
	"time"

	"facturamas-api/internal/domain"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type MongoClientRepository struct {
	collection *mongo.Collection
}

func NewMongoClientRepository(db *mongo.Database) *MongoClientRepository {
	return &MongoClientRepository{
		collection: db.Collection("clients"),
	}
}

func (r *MongoClientRepository) Create(ctx context.Context, client *domain.Client) error {
	client.ID = primitive.NewObjectID()
	client.CreatedAt = time.Now()
	client.UpdatedAt = client.CreatedAt

	_, err := r.collection.InsertOne(ctx, client)
	return err
}

func (r *MongoClientRepository) GetByID(ctx context.Context, profileID string, id string) (*domain.Client, error) {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	result := &domain.Client{}
	filter := bson.M{"_id": objectID}
	if profileID != "" {
		filter["profileId"] = profileID
	}
	err = r.collection.FindOne(ctx, filter).Decode(result)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("client not found")
		}
		return nil, err
	}

	return result, nil
}

func (r *MongoClientRepository) GetAll(ctx context.Context, profileID string) ([]domain.Client, error) {
	filter := bson.M{}
	if profileID != "" {
		filter["profileId"] = profileID
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var clients []domain.Client
	if err := cursor.All(ctx, &clients); err != nil {
		return nil, err
	}

	if clients == nil {
		clients = []domain.Client{}
	}

	return clients, nil
}

func (r *MongoClientRepository) ReplaceAll(ctx context.Context, clients []domain.Client) error {
	if _, err := r.collection.DeleteMany(ctx, bson.M{}); err != nil {
		return err
	}

	if len(clients) == 0 {
		return nil
	}

	now := time.Now()
	docs := make([]interface{}, 0, len(clients))
	for i := range clients {
		if clients[i].ID.IsZero() {
			clients[i].ID = primitive.NewObjectID()
		}
		if clients[i].CreatedAt.IsZero() {
			clients[i].CreatedAt = now
		}
		if clients[i].UpdatedAt.IsZero() {
			clients[i].UpdatedAt = clients[i].CreatedAt
		}
		docs = append(docs, clients[i])
	}

	_, err := r.collection.InsertMany(ctx, docs)
	return err
}

func (r *MongoClientRepository) Update(ctx context.Context, id string, client *domain.Client) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	client.UpdatedAt = time.Now()
	_, err = r.collection.UpdateOne(
		ctx,
		bson.M{"_id": objectID},
		bson.M{"$set": client},
	)
	return err
}

func (r *MongoClientRepository) Delete(ctx context.Context, id string) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": objectID})
	if err != nil {
		return err
	}

	if result.DeletedCount == 0 {
		return errors.New("client not found")
	}

	return nil
}

func (r *MongoClientRepository) DeleteAll(ctx context.Context, profileID string) error {
	filter := bson.M{}
	if profileID != "" {
		filter["profileId"] = profileID
	}
	_, err := r.collection.DeleteMany(ctx, filter)
	return err
}
