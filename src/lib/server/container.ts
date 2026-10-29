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
import { getWhatsAppSessionManager } from '#lib/features/integrations/whatsapp/application/whatsapp-session-manager';
import { getChatService } from '#lib/features/messaging/application/chat.service';

/**
 * Punto único de ensamblado de dependencias (Composición Hexagonal / Vertical Slice).
 * Mantiene singleton del pool de BD (PGlite) y de la instancia de BetterAuth
 * para evitar bloqueos de archivos WASM, mientras que los servicios se instancian
 * limpiamente para reflejar cualquier cambio en caliente (HMR).
 */
const globalForServices = globalThis as unknown as {
	_betterAuth?: BetterAuthInstance;
};

export function getServices() {
	const db = getDb();
	const itemRepository = new DrizzleItemRepository(db);
	const recipeRepository = new DrizzleRecipeRepository(db);
	const businessRepository = new DrizzleBusinessRepository(db);
	const orderRepository = new DrizzleOrderRepository(db);

	if (!globalForServices._betterAuth) {
		globalForServices._betterAuth = createBetterAuthInstance(db);
	}
	const authRepository = new BetterAuthRepository(globalForServices._betterAuth);

	const itemService = new ItemService(itemRepository);
	const recipeService = new RecipeService(recipeRepository, itemRepository);
	const authService = new AuthService(authRepository);
	const businessService = new BusinessService(businessRepository);
	const orderService = new OrderService(orderRepository, itemRepository, recipeService);
	const whatsAppSessionManager = getWhatsAppSessionManager();
	const chatService = getChatService();

	return {
		itemService,
		recipeService,
		authService,
		businessService,
		orderService,
		whatsAppSessionManager,
		chatService,
		betterAuth: globalForServices._betterAuth
	};
}
