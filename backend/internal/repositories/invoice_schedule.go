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

type MongoInvoiceScheduleRepository struct {
	collection *mongo.Collection
}

func NewMongoInvoiceScheduleRepository(db *mongo.Database) *MongoInvoiceScheduleRepository {
	return &MongoInvoiceScheduleRepository{
		collection: db.Collection("invoice_schedules"),
	}
}

func (r *MongoInvoiceScheduleRepository) Create(ctx context.Context, schedule *domain.InvoiceSchedule) error {
	schedule.ID = primitive.NewObjectID()
	now := time.Now()
	schedule.CreatedAt = now
	schedule.UpdatedAt = now

	_, err := r.collection.InsertOne(ctx, schedule)
	return err
}

func (r *MongoInvoiceScheduleRepository) GetByID(ctx context.Context, profileID string, id string) (*domain.InvoiceSchedule, error) {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	filter := bson.M{"_id": objectID}
	if profileID != "" {
		filter["profileId"] = profileID
	}

	result := &domain.InvoiceSchedule{}
	err = r.collection.FindOne(ctx, filter).Decode(result)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("invoice schedule not found")
		}
		return nil, err
	}
	return result, nil
}

func (r *MongoInvoiceScheduleRepository) GetAll(ctx context.Context, profileID string) ([]domain.InvoiceSchedule, error) {
	filter := bson.M{}
	if profileID != "" {
		filter["profileId"] = profileID
	}

	cursor, err := r.collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "nextRunDate", Value: 1}, {Key: "createdAt", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var schedules []domain.InvoiceSchedule
	if err := cursor.All(ctx, &schedules); err != nil {
		return nil, err
	}
	if schedules == nil {
		schedules = []domain.InvoiceSchedule{}
	}
	return schedules, nil
}

func (r *MongoInvoiceScheduleRepository) GetDueSchedules(ctx context.Context, now time.Time) ([]domain.InvoiceSchedule, error) {
	filter := bson.M{
		"active": true,
		"nextRunDate": bson.M{
			"$lte": now,
		},
		"$or": []bson.M{
			{"endDate": bson.M{"$exists": false}},
			{"endDate": bson.M{"$eq": time.Time{}}},
			{"endDate": bson.M{"$gte": now}},
		},
	}

	cursor, err := r.collection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "nextRunDate", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var schedules []domain.InvoiceSchedule
	if err := cursor.All(ctx, &schedules); err != nil {
		return nil, err
	}
	if schedules == nil {
		schedules = []domain.InvoiceSchedule{}
	}
	return schedules, nil
}

func (r *MongoInvoiceScheduleRepository) Update(ctx context.Context, id string, schedule *domain.InvoiceSchedule) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	schedule.UpdatedAt = time.Now()
	_, err = r.collection.UpdateOne(ctx, bson.M{"_id": objectID}, bson.M{"$set": schedule})
	return err
}

func (r *MongoInvoiceScheduleRepository) Delete(ctx context.Context, id string) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": objectID})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return errors.New("invoice schedule not found")
	}
	return nil
}
