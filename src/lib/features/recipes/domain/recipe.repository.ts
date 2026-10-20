import type {
	RecipeLine,
	RecipeLineWithComponent,
	CreateRecipeLineInput,
	UpdateRecipeLineInput
} from './recipe.entity';

export interface IRecipeRepository {
	findAllLinesByBusiness(businessId: string): Promise<RecipeLine[]>;
	findLinesByParentId(
		parentItemId: string,
		businessId: string
	): Promise<RecipeLineWithComponent[]>;
	findLineById(id: string): Promise<RecipeLine | null>;
	createLine(input: CreateRecipeLineInput): Promise<RecipeLine>;
	updateLine(id: string, input: UpdateRecipeLineInput): Promise<RecipeLine | null>;
	deleteLine(id: string): Promise<boolean>;
}
