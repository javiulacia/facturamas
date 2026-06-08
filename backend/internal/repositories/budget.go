package repositories

import (
	"context"
	"errors"
	"sort"
	"time"

	"facturamas-api/internal/domain"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type MongoBudgetRepository struct {
	collection *mongo.Collection
}

func NewMongoBudgetRepository(db *mongo.Database) *MongoBudgetRepository {
	return &MongoBudgetRepository{
		collection: db.Collection("budgets"),
	}
}

func (r *MongoBudgetRepository) Create(ctx context.Context, budget *domain.Budget) error {
	budget.ID = primitive.NewObjectID()
	now := time.Now()
	budget.CreatedAt = now
	budget.UpdatedAt = now

	_, err := r.collection.InsertOne(ctx, budget)
	return err
}

func (r *MongoBudgetRepository) GetByID(ctx context.Context, profileID string, id string) (*domain.Budget, error) {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	filter := bson.M{"_id": objectID}
	if profileID != "" {
		filter["profileId"] = profileID
	}

	result := &domain.Budget{}
	err = r.collection.FindOne(ctx, filter).Decode(result)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, errors.New("budget not found")
		}
		return nil, err
	}
	return result, nil
}

func (r *MongoBudgetRepository) GetAll(ctx context.Context, profileID string) ([]domain.Budget, error) {
	filter := bson.M{}
	if profileID != "" {
		filter["profileId"] = profileID
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var budgets []domain.Budget
	if err := cursor.All(ctx, &budgets); err != nil {
		return nil, err
	}
	if budgets == nil {
		budgets = []domain.Budget{}
	}
	return budgets, nil
}

func (r *MongoBudgetRepository) ReplaceAll(ctx context.Context, budgets []domain.Budget) error {
	if _, err := r.collection.DeleteMany(ctx, bson.M{}); err != nil {
		return err
	}

	if len(budgets) == 0 {
		return nil
	}

	now := time.Now()
	docs := make([]interface{}, 0, len(budgets))
	for i := range budgets {
		if budgets[i].ID.IsZero() {
			budgets[i].ID = primitive.NewObjectID()
		}
		if budgets[i].CreatedAt.IsZero() {
			budgets[i].CreatedAt = now
		}
		if budgets[i].UpdatedAt.IsZero() {
			budgets[i].UpdatedAt = budgets[i].CreatedAt
		}
		docs = append(docs, budgets[i])
	}

	_, err := r.collection.InsertMany(ctx, docs)
	return err
}

func (r *MongoBudgetRepository) GetUsedSequencesBySeries(ctx context.Context, profileID string, series string) ([]int64, error) {
	filter := bson.M{"series": series}
	if profileID != "" {
		filter["profileId"] = profileID
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	type budgetSequence struct {
		Sequence int64 `bson:"sequence"`
	}

	sequences := make([]int64, 0)
	for cursor.Next(ctx) {
		var result budgetSequence
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

func (r *MongoBudgetRepository) Update(ctx context.Context, id string, budget *domain.Budget) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	budget.UpdatedAt = time.Now()
	_, err = r.collection.UpdateOne(
		ctx,
		bson.M{"_id": objectID},
		bson.M{"$set": budget},
	)
	return err
}

func (r *MongoBudgetRepository) Delete(ctx context.Context, id string) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": objectID})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return errors.New("budget not found")
	}
	return nil
}

func (r *MongoBudgetRepository) DeleteAll(ctx context.Context, profileID string) error {
	filter := bson.M{}
	if profileID != "" {
		filter["profileId"] = profileID
	}
	_, err := r.collection.DeleteMany(ctx, filter)
	return err
}
