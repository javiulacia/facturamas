package repositories

import (
	"context"
	"errors"
	"sort"

	"facturamas-api/internal/domain"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type MongoInvoiceRepository struct {
	collection *mongo.Collection
}

func NewMongoInvoiceRepository(db *mongo.Database) *MongoInvoiceRepository {
	return &MongoInvoiceRepository{
		collection: db.Collection("invoices"),
	}
}

func (r *MongoInvoiceRepository) Create(ctx context.Context, invoice *domain.Invoice) error {
	invoice.ID = primitive.NewObjectID()
	invoice.CreatedAt = primitive.NewDateTimeFromTime(primitive.NewObjectID().Timestamp()).Time()
	invoice.UpdatedAt = invoice.CreatedAt

	_, err := r.collection.InsertOne(ctx, invoice)
	return err
}

func (r *MongoInvoiceRepository) GetByID(ctx context.Context, profileID string, id string) (*domain.Invoice, error) {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	result := &domain.Invoice{}
	filter := bson.M{"_id": objectID}
	if profileID != "" {
		filter["profileId"] = profileID
	}
	err = r.collection.FindOne(ctx, filter).Decode(result)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("invoice not found")
		}
		return nil, err
	}
	return result, nil
}

func (r *MongoInvoiceRepository) GetAll(ctx context.Context, profileID string) ([]domain.Invoice, error) {
	filter := bson.M{}
	if profileID != "" {
		filter["profileId"] = profileID
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var invoices []domain.Invoice
	if err = cursor.All(ctx, &invoices); err != nil {
		return nil, err
	}

	if invoices == nil {
		invoices = []domain.Invoice{}
	}

	return invoices, nil
}

func (r *MongoInvoiceRepository) ReplaceAll(ctx context.Context, invoices []domain.Invoice) error {
	if _, err := r.collection.DeleteMany(ctx, bson.M{}); err != nil {
		return err
	}

	if len(invoices) == 0 {
		return nil
	}

	now := primitive.NewDateTimeFromTime(primitive.NewObjectID().Timestamp()).Time()
	docs := make([]interface{}, 0, len(invoices))
	for i := range invoices {
		if invoices[i].ID.IsZero() {
			invoices[i].ID = primitive.NewObjectID()
		}
		if invoices[i].CreatedAt.IsZero() {
			invoices[i].CreatedAt = now
		}
		if invoices[i].UpdatedAt.IsZero() {
			invoices[i].UpdatedAt = invoices[i].CreatedAt
		}
		docs = append(docs, invoices[i])
	}

	_, err := r.collection.InsertMany(ctx, docs)
	return err
}

func (r *MongoInvoiceRepository) GetUsedSequencesBySeries(ctx context.Context, profileID string, series string) ([]int64, error) {
	filter := bson.M{"series": series}
	if profileID != "" {
		filter["profileId"] = profileID
	}

	cursor, err := r.collection.Find(
		ctx,
		filter,
	)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	type invoiceSequence struct {
		Sequence int64 `bson:"sequence"`
	}

	sequences := make([]int64, 0)
	for cursor.Next(ctx) {
		var result invoiceSequence
		if err := cursor.Decode(&result); err != nil {
			return nil, err
		}
		if result.Sequence > 0 {
			sequences = append(sequences, result.Sequence)
		}
	}

	if err := cursor.Err(); err != nil {
		return nil, err
	}

	sort.Slice(sequences, func(i, j int) bool {
		return sequences[i] < sequences[j]
	})

	return sequences, nil
}

func (r *MongoInvoiceRepository) Update(ctx context.Context, id string, invoice *domain.Invoice) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	invoice.UpdatedAt = primitive.NewDateTimeFromTime(primitive.NewObjectID().Timestamp()).Time()

	_, err = r.collection.UpdateOne(
		ctx,
		bson.M{"_id": objectID},
		bson.M{"$set": invoice},
	)
	return err
}

func (r *MongoInvoiceRepository) Delete(ctx context.Context, id string) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": objectID})
	if err != nil {
		return err
	}

	if result.DeletedCount == 0 {
		return errors.New("invoice not found")
	}

	return nil
}

func (r *MongoInvoiceRepository) DeleteAll(ctx context.Context, profileID string) error {
	filter := bson.M{}
	if profileID != "" {
		filter["profileId"] = profileID
	}
	_, err := r.collection.DeleteMany(ctx, filter)
	return err
}
