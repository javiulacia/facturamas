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

type MongoContactRepository struct {
	collection *mongo.Collection
}

func NewMongoContactRepository(db *mongo.Database) *MongoContactRepository {
	return &MongoContactRepository{
		collection: db.Collection("contacts"),
	}
}

func (r *MongoContactRepository) Create(ctx context.Context, contact *domain.Contact) error {
	contact.ID = primitive.NewObjectID()
	contact.CreatedAt = time.Now()
	contact.UpdatedAt = contact.CreatedAt

	_, err := r.collection.InsertOne(ctx, contact)
	return err
}

func (r *MongoContactRepository) CreateMany(ctx context.Context, contacts []domain.Contact) error {
	if len(contacts) == 0 {
		return nil
	}

	now := time.Now()
	docs := make([]interface{}, 0, len(contacts))
	for i := range contacts {
		if contacts[i].ID.IsZero() {
			contacts[i].ID = primitive.NewObjectID()
		}
		if contacts[i].CreatedAt.IsZero() {
			contacts[i].CreatedAt = now
		}
		if contacts[i].UpdatedAt.IsZero() {
			contacts[i].UpdatedAt = contacts[i].CreatedAt
		}
		docs = append(docs, contacts[i])
	}

	_, err := r.collection.InsertMany(ctx, docs)
	return err
}

func (r *MongoContactRepository) Count(ctx context.Context, profileID string) (int64, error) {
	filter := bson.M{}
	if profileID != "" {
		filter["profileId"] = profileID
	}
	return r.collection.CountDocuments(ctx, filter)
}

func (r *MongoContactRepository) GetByID(ctx context.Context, profileID string, id string) (*domain.Contact, error) {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	result := &domain.Contact{}
	filter := bson.M{"_id": objectID}
	if profileID != "" {
		filter["profileId"] = profileID
	}
	err = r.collection.FindOne(ctx, filter).Decode(result)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("contact not found")
		}
		return nil, err
	}

	return result, nil
}

func (r *MongoContactRepository) GetAll(ctx context.Context, profileID string) ([]domain.Contact, error) {
	filter := bson.M{}
	if profileID != "" {
		filter["profileId"] = profileID
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var contacts []domain.Contact
	if err := cursor.All(ctx, &contacts); err != nil {
		return nil, err
	}

	if contacts == nil {
		contacts = []domain.Contact{}
	}

	return contacts, nil
}

func (r *MongoContactRepository) ReplaceAll(ctx context.Context, contacts []domain.Contact) error {
	if _, err := r.collection.DeleteMany(ctx, bson.M{}); err != nil {
		return err
	}

	if len(contacts) == 0 {
		return nil
	}

	now := time.Now()
	docs := make([]interface{}, 0, len(contacts))
	for i := range contacts {
		if contacts[i].ID.IsZero() {
			contacts[i].ID = primitive.NewObjectID()
		}
		if contacts[i].CreatedAt.IsZero() {
			contacts[i].CreatedAt = now
		}
		if contacts[i].UpdatedAt.IsZero() {
			contacts[i].UpdatedAt = contacts[i].CreatedAt
		}
		docs = append(docs, contacts[i])
	}

	_, err := r.collection.InsertMany(ctx, docs)
	return err
}

func (r *MongoContactRepository) Update(ctx context.Context, id string, contact *domain.Contact) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	contact.UpdatedAt = time.Now()
	_, err = r.collection.UpdateOne(
		ctx,
		bson.M{"_id": objectID},
		bson.M{"$set": contact},
	)
	return err
}

func (r *MongoContactRepository) Delete(ctx context.Context, id string) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": objectID})
	if err != nil {
		return err
	}

	if result.DeletedCount == 0 {
		return errors.New("contact not found")
	}

	return nil
}

func (r *MongoContactRepository) DeleteAll(ctx context.Context, profileID string) error {
	filter := bson.M{}
	if profileID != "" {
		filter["profileId"] = profileID
	}
	_, err := r.collection.DeleteMany(ctx, filter)
	return err
}
