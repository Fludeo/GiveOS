import { getDb } from './db';
import { DrizzleItemRepository } from '#lib/features/items/infrastructure/drizzle-item.repository';
import { ItemService } from '#lib/features/items/application/item.service';
import { DrizzleRecipeRepository } from '#lib/features/recipes/infrastructure/drizzle-recipe.repository';
import { RecipeService } from '#lib/features/recipes/application/recipe.service';
import {
	BetterAuthRepository,
	createBetterAuthInstance,
	type BetterAuthInstance
} from '#lib/features/auth/infrastructure/better-auth.provider';
import { AuthService } from '#lib/features/auth/application/auth.service';
import { DrizzleBusinessRepository } from '#lib/features/businesses/infrastructure/drizzle-business.repository';
import { BusinessService } from '#lib/features/businesses/application/business.service';
import { DrizzleOrderRepository } from '#lib/features/orders/infrastructure/drizzle-order.repository';
import { OrderService } from '#lib/features/orders/application/order.service';

/**
 * Punto único de ensamblado de dependencias (Composición Hexagonal / Vertical Slice).
 * Para cambiar de SQLite/Drizzle o proveedor de Auth en el futuro,
 * basta con sustituir las implementaciones concretas de los repositorios aquí.
 */
let _itemService: ItemService | null = null;
let _recipeService: RecipeService | null = null;
let _authService: AuthService | null = null;
let _businessService: BusinessService | null = null;
let _orderService: OrderService | null = null;
let _betterAuth: BetterAuthInstance | null = null;

export function getServices() {
	if (
		!_itemService ||
		!_recipeService ||
		!_authService ||
		!_businessService ||
		!_orderService ||
		!_betterAuth
	) {
		const db = getDb();
		const itemRepository = new DrizzleItemRepository(db);
		const recipeRepository = new DrizzleRecipeRepository(db);
		const businessRepository = new DrizzleBusinessRepository(db);
		const orderRepository = new DrizzleOrderRepository(db);
		_betterAuth = createBetterAuthInstance(db);
		const authRepository = new BetterAuthRepository(_betterAuth);

		_itemService = new ItemService(itemRepository);
		_recipeService = new RecipeService(recipeRepository, itemRepository);
		_authService = new AuthService(authRepository);
		_businessService = new BusinessService(businessRepository);
		_orderService = new OrderService(orderRepository, itemRepository, _recipeService);
	}
	return {
		itemService: _itemService,
		recipeService: _recipeService,
		authService: _authService,
		businessService: _businessService,
		orderService: _orderService,
		betterAuth: _betterAuth
	};
}
