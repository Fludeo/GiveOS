import { applyStockConsumption, convertQuantity, getDirectUnitCost, type Item } from '#lib/features/items/domain/item.entity';
import type { IItemRepository } from '#lib/features/items/domain/item.repository';
import type { RecipeService } from '#lib/features/recipes/application/recipe.service';
import type { RecipeTreeNode } from '#lib/features/recipes/domain/recipe.entity';
import {
	computeOrderStatusFromItems,
	computePaymentStatus,
	generateNextOrderNumber,
	generateNextSalesProductCode,
	type PriceTier,
	type CreateOrderInput,
	type CreateSalesProductInput,
	type OrderStatus,
	type OrderWithItems,
	type PaymentStatus,
	type PreorderForecastLine,
	type PreorderForecastSummary,
	type SalesProduct,
	type SalesProductComponentInput,
	type SalesProductComponentWithItem,
	type SalesProductWithItems,
	type UpdateSalesProductInput
} from '../domain/order.entity';
import type { IOrderRepository } from '../domain/order.repository';

export class OrderService {
	constructor(
		private readonly orderRepo: IOrderRepository,
		private readonly itemRepo: IItemRepository,
		private readonly recipeService: RecipeService
	) {}

	async listSalesProducts(businessId: string): Promise<SalesProductWithItems[]> {
		const [products, items, recipeSummaries] = await Promise.all([
			this.orderRepo.findSalesProductsByBusiness(businessId),
			this.itemRepo.findAllByBusiness(businessId),
			this.recipeService.getAllRecipeSummaries(businessId)
		]);

		const productIds = products.map((p) => p.id);
		const allProductItems = await this.orderRepo.findSalesProductItemsByProductIds(productIds);

		const itemsById = new Map<string, Item>(items.map((i) => [i.id, i]));
		const productItemsByProductId = new Map<string, typeof allProductItems>();

		for (const row of allProductItems) {
			const list = productItemsByProductId.get(row.salesProductId) ?? [];
			list.push(row);
			productItemsByProductId.set(row.salesProductId, list);
		}

		return products.map((prod) => {
			const rows = productItemsByProductId.get(prod.id) ?? [];
			let estimatedRecipeCost = 0;

			const components: SalesProductComponentWithItem[] = rows.map((row) => {
				const item = itemsById.get(row.itemId) ?? null;
				const unitCost = item
					? (recipeSummaries[item.id]?.estimatedUnitCost ?? getDirectUnitCost(item))
					: 0;
				const lineRecipeCost = unitCost * row.quantity;
				estimatedRecipeCost += lineRecipeCost;
				return {
					...row,
					item,
					lineRecipeCost
				};
			});

			const totalQty = components.reduce((acc, c) => acc + c.quantity, 0);

			let parsedTiers: PriceTier[] = [];
			if (Array.isArray(prod.pricingTiers)) {
				parsedTiers = prod.pricingTiers;
			} else if (typeof prod.pricingTiers === 'string') {
				try {
					parsedTiers = JSON.parse(prod.pricingTiers);
				} catch {
					parsedTiers = [];
				}
			}

			return {
				...prod,
				pricingTiers: parsedTiers,
				components,
				estimatedRecipeCost,
				isCombo: components.length > 1 || totalQty > 1
			};
		});
	}

	private async validateAndNormalizeComponents(
		businessId: string,
		components: SalesProductComponentInput[]
	): Promise<SalesProductComponentInput[]> {
		if (!components || components.length === 0) {
			throw new Error('Debes vincular al menos un Producto Final del inventario/recetas.');
		}

		const mergedMap = new Map<string, number>();

		for (const comp of components) {
			const itemId = comp.itemId?.trim();
			const qty = Number(comp.quantity);
			if (!itemId) {
				throw new Error('Todos los componentes del producto deben tener un ítem seleccionado.');
			}
			if (!Number.isFinite(qty) || qty <= 0) {
				throw new Error('La cantidad de cada Producto Final debe ser mayor a 0.');
			}

			const linkedItem = await this.itemRepo.findById(itemId, businessId);
			if (!linkedItem) {
				throw new Error('Uno de los ítems seleccionados no existe en el inventario.');
			}
			// Permite vincular cualquier ítem de inventario (Insumo o Elaboración)
			mergedMap.set(itemId, Number(((mergedMap.get(itemId) ?? 0) + qty).toFixed(4)));
		}

		return Array.from(mergedMap.entries()).map(([itemId, quantity]) => ({
			itemId,
			quantity
		}));
	}

	private normalizePricingTiers(tiers?: PriceTier[]): PriceTier[] {
		if (!tiers || !Array.isArray(tiers)) return [];
		return tiers
			.filter((t) => Number(t.minQuantity) > 1 && Number(t.value) > 0)
			.map((t) => ({
				minQuantity: Number(t.minQuantity),
				type: t.type === 'fixed_price' ? ('fixed_price' as const) : ('percentage' as const),
				value: Number(t.value)
			}))
			.sort((a, b) => a.minQuantity - b.minQuantity);
	}

	async createSalesProduct(input: CreateSalesProductInput): Promise<SalesProduct> {
		if (!input.name.trim()) {
			throw new Error('El nombre comercial del producto es obligatorio.');
		}

		const normalizedComponents = await this.validateAndNormalizeComponents(
			input.businessId,
			input.components
		);

		let normalizedCode = (input.code ?? '').trim().toUpperCase();
		if (!normalizedCode) {
			const existing = await this.orderRepo.findSalesProductsByBusiness(input.businessId);
			normalizedCode = generateNextSalesProductCode(existing.map((p) => p.code));
		} else {
			const duplicate = await this.orderRepo.findSalesProductByCode(
				normalizedCode,
				input.businessId
			);
			if (duplicate) {
				throw new Error(
					`Ya existe un producto de venta con el código "${normalizedCode}".`
				);
			}
		}

		return this.orderRepo.createSalesProduct({
			...input,
			code: normalizedCode,
			components: normalizedComponents,
			pricingTiers: this.normalizePricingTiers(input.pricingTiers)
		});
	}

	async updateSalesProduct(
		id: string,
		businessId: string,
		input: UpdateSalesProductInput
	): Promise<SalesProduct> {
		const existing = await this.orderRepo.findSalesProductById(id, businessId);
		if (!existing) {
			throw new Error('Producto de venta no encontrado.');
		}

		let normalizedComponents: SalesProductComponentInput[] | undefined = undefined;
		if (input.components !== undefined) {
			normalizedComponents = await this.validateAndNormalizeComponents(
				businessId,
				input.components
			);
		}

		const updated = await this.orderRepo.updateSalesProduct(id, businessId, {
			...input,
			components: normalizedComponents,
			pricingTiers: input.pricingTiers !== undefined ? this.normalizePricingTiers(input.pricingTiers) : undefined
		});
		if (!updated) {
			throw new Error('No se pudo actualizar el producto de venta.');
		}
		return updated;
	}

	async deleteSalesProduct(id: string, businessId: string): Promise<void> {
		const ok = await this.orderRepo.deleteSalesProduct(id, businessId);
		if (!ok) {
			throw new Error('No se pudo eliminar el producto de venta.');
		}
	}

	async toggleSalesProductShortcut(id: string, businessId: string): Promise<SalesProduct> {
		const existing = await this.orderRepo.findSalesProductById(id, businessId);
		if (!existing) {
			throw new Error('Producto de venta no encontrado.');
		}
		const updated = await this.orderRepo.updateSalesProduct(id, businessId, {
			isShortcut: !existing.isShortcut
		});
		if (!updated) {
			throw new Error('No se pudo actualizar el atajo del producto.');
		}
		return updated;
	}

	async listOrders(businessId: string): Promise<OrderWithItems[]> {
		return this.orderRepo.findOrdersByBusiness(businessId);
	}

	async createOrder(input: CreateOrderInput): Promise<OrderWithItems> {
		if (!input.lines || input.lines.length === 0) {
			throw new Error('La orden debe contener al menos un producto.');
		}

		const [existingOrders, salesProducts, allItems] = await Promise.all([
			this.orderRepo.findOrdersByBusiness(input.businessId),
			this.listSalesProducts(input.businessId),
			this.itemRepo.findAllByBusiness(input.businessId)
		]);

		const productsById = new Map(salesProducts.map((p) => [p.id, p]));
		const itemsById = new Map(allItems.map((i) => [i.id, i]));

		const orderNumber = generateNextOrderNumber(existingOrders.map((o) => o.orderNumber));

		const preparedLines: Array<{
			salesProductId: string;
			productName: string;
			quantity: number;
			unitPrice: number;
			fulfillmentType: 'immediate' | 'preorder';
			status: 'delivered' | 'pending_delivery';
			notes: string | null;
		}> = [];

		let totalAmount = 0;

		for (const line of input.lines) {
			if (line.quantity <= 0) {
				throw new Error('La cantidad de cada producto en la orden debe ser mayor a 0.');
			}
			const salesProduct = productsById.get(line.salesProductId);
			if (!salesProduct) {
				throw new Error('Uno de los productos seleccionados no existe en el catálogo de venta.');
			}
			if (salesProduct.components.length === 0) {
				throw new Error(
					`El producto "${salesProduct.name}" no tiene ningún ítem de inventario vinculado en su configuración.`
				);
			}

			const unitPrice =
				line.unitPrice !== undefined && Number.isFinite(line.unitPrice) && line.unitPrice >= 0
					? line.unitPrice
					: salesProduct.salePrice;

			const fulfillmentType =
				line.fulfillmentType === 'preorder' ? 'preorder' : 'immediate';
			const status = fulfillmentType === 'preorder' ? 'pending_delivery' : 'delivered';

			totalAmount += line.quantity * unitPrice;

			preparedLines.push({
				salesProductId: salesProduct.id,
				productName: salesProduct.name,
				quantity: line.quantity,
				unitPrice,
				fulfillmentType,
				status,
				notes: line.notes?.trim() || null
			});
		}

		// Si la orden nace como no confirmada ('unconfirmed'), NO descuenta stock en este momento.
		// Solo descuenta stock si nace confirmada (default).
		const initialStatus: OrderStatus = input.status === 'unconfirmed'
			? 'unconfirmed'
			: computeOrderStatusFromItems(preparedLines);

		if (initialStatus !== 'unconfirmed') {
			// Descontar stock directamente para todos los componentes (Productos Finales) de las líneas que se venden/entregan en el momento ('immediate')
			for (const line of preparedLines) {
				if (line.fulfillmentType === 'immediate') {
					const salesProduct = productsById.get(line.salesProductId);
					if (!salesProduct) continue;

					for (const comp of salesProduct.components) {
						const targetItem = itemsById.get(comp.itemId);
						if (targetItem) {
							const consumeQty = line.quantity * comp.quantity;
							const nextStock = Math.max(
								0,
								Number((targetItem.currentStock - consumeQty).toFixed(4))
							);
							let newBatches = targetItem.batches;
							let newRefCost = targetItem.referenceCost;
							if (targetItem.batches && targetItem.batches.length > 0) {
								const res = applyStockConsumption(targetItem.batches, consumeQty, targetItem.referenceCost);
								newBatches = res.batches;
								newRefCost = res.newReferenceCost;
							}
							const updatedItem = await this.itemRepo.update(
								targetItem.id,
								input.businessId,
								{
									currentStock: nextStock,
									referenceCost: newRefCost,
									batches: newBatches
								}
							);
							if (updatedItem) {
								itemsById.set(targetItem.id, updatedItem);
							}
						}
					}
				}
			}
		}

		const { paymentStatus, normalizedPaidAmount } = computePaymentStatus(
			totalAmount,
			input.paidAmount ?? 0,
			input.paymentStatus
		);

		return this.orderRepo.createOrderWithItems(
			{
				businessId: input.businessId,
				orderNumber,
				customerName: input.customerName?.trim() || 'Cliente Mostrador',
				status: initialStatus,
				paymentStatus,
				totalAmount: Number(totalAmount.toFixed(2)),
				paidAmount: Number(normalizedPaidAmount.toFixed(2)),
				deliveryDate: input.deliveryDate ?? null,
				notes: input.notes?.trim() || null,
				transactionId: input.transactionId?.trim() || null
			},
			preparedLines
		);
	}

	/**
	 * Completa/entrega una línea por encargo ("Just-In-Time"):
	 * Para cada Producto Final que compone el producto de venta (sea individual o Combo):
	 * 1. Suma +Q al ítem asociado produciéndolo mediante su Receta (lo cual consume sus sub-ensambles/insumos).
	 * 2. Resta -Q al ítem asociado por la entrega al cliente, dejando su stock tal como estaba.
	 */
	async deliverOrderItemJustInTime(
		businessId: string,
		orderId: string,
		lineId: string
	): Promise<OrderWithItems> {
		const order = await this.orderRepo.findOrderById(orderId, businessId);
		if (!order) {
			throw new Error('Orden no encontrada.');
		}
		if (order.status === 'cancelled') {
			throw new Error('No se pueden entregar ítems de una orden cancelada.');
		}

		const line = order.items.find((i) => i.id === lineId);
		if (!line) {
			throw new Error('Línea de orden no encontrada.');
		}
		if (line.status === 'delivered') {
			return order;
		}

		const productComponents = await this.orderRepo.findSalesProductItemsByProductIds([
			line.salesProductId
		]);

		for (const comp of productComponents) {
			const totalItemQty = Number((line.quantity * comp.quantity).toFixed(4));
			if (totalItemQty <= 0) continue;

			// Paso 1 (+Q): Producir el lote JIT (suma +totalItemQty al Producto Final y descuenta sus sub-ensambles/insumos directos de su Receta)
			const { parent: afterProduce } = await this.recipeService.produceItemBatch(
				businessId,
				comp.itemId,
				totalItemQty
			);

			// Paso 2 (-Q): Descontar -totalItemQty por la venta/entrega para que el stock del Producto Final quede igual que antes
			const finalStock = Math.max(
				0,
				Number((afterProduce.currentStock - totalItemQty).toFixed(4))
			);
			await this.itemRepo.update(comp.itemId, businessId, {
				currentStock: finalStock
			});
		}

		await this.orderRepo.updateOrderItemStatus(line.id, 'delivered');

		const updatedItems = order.items.map((i) =>
			i.id === line.id ? { ...i, status: 'delivered' as const } : i
		);
		const nextOrderStatus = computeOrderStatusFromItems(updatedItems);

		await this.orderRepo.updateOrder(order.id, businessId, {
			status: nextOrderStatus
		});

		return (await this.orderRepo.findOrderById(order.id, businessId))!;
	}

	/**
	 * Completa todas las líneas pendientes de una orden ejecutando el flujo JIT (+1 / -1) en cada encargo pendiente.
	 */
	async completeOrderJustInTime(businessId: string, orderId: string): Promise<OrderWithItems> {
		const order = await this.orderRepo.findOrderById(orderId, businessId);
		if (!order) {
			throw new Error('Orden no encontrada.');
		}
		if (order.status === 'cancelled') {
			throw new Error('No se puede completar una orden cancelada.');
		}

		const pendingLines = order.items.filter((i) => i.status === 'pending_delivery');
		for (const line of pendingLines) {
			await this.deliverOrderItemJustInTime(businessId, orderId, line.id);
		}

		await this.orderRepo.updateOrder(orderId, businessId, {
			status: 'completed',
			paymentStatus: 'paid',
			paidAmount: order.totalAmount
		});

		return (await this.orderRepo.findOrderById(orderId, businessId))!;
	}

	async updateOrderPayment(
		businessId: string,
		orderId: string,
		paidAmount: number,
		explicitStatus?: PaymentStatus,
		transactionId?: string | null
	): Promise<OrderWithItems> {
		const order = await this.orderRepo.findOrderById(orderId, businessId);
		if (!order) {
			throw new Error('Orden no encontrada.');
		}

		const { paymentStatus, normalizedPaidAmount } = computePaymentStatus(
			order.totalAmount,
			paidAmount,
			explicitStatus
		);

		await this.orderRepo.updateOrder(orderId, businessId, {
			paymentStatus,
			paidAmount: Number(normalizedPaidAmount.toFixed(2)),
			...(transactionId !== undefined ? { transactionId: transactionId?.trim() || null } : {})
		});

		return (await this.orderRepo.findOrderById(orderId, businessId))!;
	}

	/**
	 * Confirma una orden que estaba en estado 'unconfirmed'.
	 * Al confirmarla:
	 * 1. Descuenta stock inmediato de los productos elaborados (si contiene ítems de entrega inmediata).
	 * 2. Actualiza el estado a 'pending' (si tiene encargos por entregar) o 'completed' (si eran todos inmediatos).
	 * 3. Opcionalmente actualiza el monto de seña / pago y el ID de transacción.
	 */
	async confirmOrder(
		businessId: string,
		orderId: string,
		options?: {
			paidAmount?: number;
			transactionId?: string | null;
		}
	): Promise<OrderWithItems> {
		const order = await this.orderRepo.findOrderById(orderId, businessId);
		if (!order) {
			throw new Error('Orden no encontrada.');
		}
		if (order.status !== 'unconfirmed') {
			throw new Error('Esta orden ya fue confirmada previamente o está cancelada.');
		}

		const [salesProducts, allItems] = await Promise.all([
			this.listSalesProducts(businessId),
			this.itemRepo.findAllByBusiness(businessId)
		]);
		const productsById = new Map(salesProducts.map((p) => [p.id, p]));
		const itemsById = new Map(allItems.map((i) => [i.id, i]));

		// Descontar stock para las líneas inmediatas al momento de confirmar
		for (const line of order.items) {
			if (line.fulfillmentType === 'immediate' && line.status !== 'cancelled') {
				const salesProduct = productsById.get(line.salesProductId);
				if (!salesProduct) continue;

				for (const comp of salesProduct.components) {
					const targetItem = itemsById.get(comp.itemId);
					if (targetItem) {
						const consumeQty = line.quantity * comp.quantity;
						const nextStock = Math.max(
							0,
							Number((targetItem.currentStock - consumeQty).toFixed(4))
						);
						let newBatches = targetItem.batches;
						let newRefCost = targetItem.referenceCost;
						if (targetItem.batches && targetItem.batches.length > 0) {
							const res = applyStockConsumption(targetItem.batches, consumeQty, targetItem.referenceCost);
							newBatches = res.batches;
							newRefCost = res.newReferenceCost;
						}
						const updatedItem = await this.itemRepo.update(
							targetItem.id,
							businessId,
							{
								currentStock: nextStock,
								referenceCost: newRefCost,
								batches: newBatches
							}
						);
						if (updatedItem) {
							itemsById.set(targetItem.id, updatedItem);
						}
					}
				}
			}
		}

		// Determinar nuevo estado según sus ítems activos
		const nextStatus = computeOrderStatusFromItems(order.items, 'pending');

		const newPaidAmount = options?.paidAmount !== undefined && options.paidAmount !== null
			? Number(options.paidAmount)
			: order.paidAmount;

		const { paymentStatus, normalizedPaidAmount } = computePaymentStatus(
			order.totalAmount,
			newPaidAmount
		);

		await this.orderRepo.updateOrder(orderId, businessId, {
			status: nextStatus,
			paymentStatus,
			paidAmount: Number(normalizedPaidAmount.toFixed(2)),
			...(options?.transactionId !== undefined
				? { transactionId: options.transactionId?.trim() || null }
				: {})
		});

		return (await this.orderRepo.findOrderById(orderId, businessId))!;
	}

	async cancelOrder(businessId: string, orderId: string): Promise<OrderWithItems> {
		const order = await this.orderRepo.findOrderById(orderId, businessId);
		if (!order) {
			throw new Error('Orden no encontrada.');
		}

		for (const line of order.items) {
			if (line.status === 'pending_delivery') {
				await this.orderRepo.updateOrderItemStatus(line.id, 'cancelled');
			}
		}

		await this.orderRepo.updateOrder(orderId, businessId, {
			status: 'cancelled'
		});

		return (await this.orderRepo.findOrderById(orderId, businessId))!;
	}

	/**
	 * Cruza las órdenes pendientes (pedidos a futuro / `pending_delivery`) con el árbol de Recetas
	 * desglosando primero los componentes de cada producto de venta (incluyendo Combos)
	 * para prever si alcanza el stock actual de Sub-ensambles y Materias Primas o si hay sobreventa/déficit.
	 */
	async getPreorderForecast(businessId: string): Promise<PreorderForecastSummary> {
		const [orders, allItems, recipeSummaries, salesProducts] = await Promise.all([
			this.orderRepo.findOrdersByBusiness(businessId),
			this.itemRepo.findAllByBusiness(businessId),
			this.recipeService.getAllRecipeSummaries(businessId),
			this.listSalesProducts(businessId)
		]);

		const itemsById = new Map<string, Item>(allItems.map((i) => [i.id, i]));
		const salesProductsById = new Map(salesProducts.map((sp) => [sp.id, sp]));
		const pendingOrders = orders.filter((o) => o.status === 'pending');

		const productDemandMap = new Map<string, number>();
		let pendingPreorderLinesCount = 0;

		for (const order of pendingOrders) {
			for (const line of order.items) {
				if (line.status === 'pending_delivery') {
					pendingPreorderLinesCount++;
					const sp = salesProductsById.get(line.salesProductId);
					if (!sp) continue;

					for (const comp of sp.components) {
						const itemQty = line.quantity * comp.quantity;
						productDemandMap.set(
							comp.itemId,
							(productDemandMap.get(comp.itemId) ?? 0) + itemQty
						);
					}
				}
			}
		}

		const productDemands: PreorderForecastSummary['productDemands'] = [];
		const subAssemblyRequiredMap = new Map<string, number>();
		const directRawRequiredMap = new Map<string, number>();

		const calcLaborLegacy = (
			qty: number,
			prepTime: number | undefined,
			passiveTime: number | undefined,
			yieldQty: number | undefined,
			scalable: boolean | undefined
		) => {
			const activeTime = prepTime && prepTime > 0 ? prepTime : 0;
			const passive = passiveTime && passiveTime > 0 ? passiveTime : 0;
			const totalTime = activeTime + passive;
			if (totalTime <= 0 || qty <= 0) {
				return { laborMinutes: 0, activeMinutes: 0, passiveMinutes: 0, batchesNeeded: 0 };
			}
			const y = yieldQty && yieldQty > 0 ? yieldQty : 1;
			if (scalable) {
				return {
					laborMinutes: Math.round((qty / y) * totalTime),
					activeMinutes: Math.round((qty / y) * activeTime),
					passiveMinutes: Math.round((qty / y) * passive),
					batchesNeeded: Number((qty / y).toFixed(2))
				};
			}
			const batches = Math.ceil(qty / y);
			return {
				laborMinutes: batches * totalTime,
				activeMinutes: batches * activeTime,
				passiveMinutes: batches * passive,
				batchesNeeded: batches
			};
		};

		const calcLaborForItem = (item: Item, qty: number) => {
			const opCosts = item.recipeConfig?.operationalCosts;
			if (opCosts && opCosts.length > 0) {
				const yieldQty = item.yieldQuantity > 0 ? item.yieldQuantity : 1;
				const batches = Math.ceil(qty / yieldQty);
				let activeMinutes = 0;
				let passiveMinutes = 0;
				let totalLaborCost = 0;

				for (const cost of opCosts) {
					const dur = Number(cost.durationMinutes) || 0;
					const rate = Number(cost.ratePerHour) || 0;
					const effectiveDur = cost.isScalable ? dur * (qty / yieldQty) : dur * batches;
					if (cost.type === 'active') {
						activeMinutes += effectiveDur;
					} else {
						passiveMinutes += effectiveDur;
					}
					totalLaborCost += (effectiveDur / 60) * rate;
				}

				const roundedActive = Math.round(activeMinutes);
				const roundedPassive = Math.round(passiveMinutes);

				return {
					laborMinutes: roundedActive + roundedPassive,
					activeMinutes: roundedActive,
					passiveMinutes: roundedPassive,
					batchesNeeded: batches,
					laborCost: Math.round(totalLaborCost * 100) / 100
				};
			}

			// Fallback a tiempos legados en caso de que aún no tenga operationalCosts desglosados
			return {
				...calcLaborLegacy(
					qty,
					item.prepTimeMinutes,
					item.passiveTimeMinutes,
					item.yieldQuantity,
					item.isPrepTimeScalable
				),
				laborCost: 0
			};
		};

		// 1. Explotar cada Producto Final demandado en pedidos futuros
		for (const [itemId, totalOrderedQty] of productDemandMap.entries()) {
			const productItem = itemsById.get(itemId);
			if (!productItem) continue;

			const isMakeToOrder = Boolean(productItem.recipeConfig?.isMakeToOrder);
			const projectedBalance = isMakeToOrder ? 0 : Number((productItem.currentStock - totalOrderedQty).toFixed(3));
			const deficitQuantity = isMakeToOrder
				? totalOrderedQty
				: (projectedBalance < 0 ? Math.abs(projectedBalance) : 0);
			const isShortage = !isMakeToOrder && deficitQuantity > 0;

			const {
				laborMinutes: laborDeficit,
				activeMinutes: activeDeficit,
				passiveMinutes: passiveDeficit,
				batchesNeeded: batchesDeficit,
				laborCost: costDeficit
			} = calcLaborForItem(productItem, deficitQuantity);

			const {
				laborMinutes: laborDemand,
				laborCost: costDemand
			} = calcLaborForItem(productItem, totalOrderedQty);

			productDemands.push({
				itemId: productItem.id,
				code: productItem.code,
				name: productItem.name,
				baseUnit: productItem.baseUnit,
				totalOrderedQty: Number(totalOrderedQty.toFixed(3)),
				currentProductStock: productItem.currentStock,
				projectedBalance,
				deficitQuantity: Number(deficitQuantity.toFixed(3)),
				isShortage,
				isMakeToOrder,
				prepTimeMinutes: productItem.prepTimeMinutes,
				passiveTimeMinutes: productItem.passiveTimeMinutes,
				isPrepTimeScalable: productItem.isPrepTimeScalable,
				yieldQuantity: productItem.yieldQuantity,
				batchesNeededForDeficit: batchesDeficit,
				laborMinutesForDeficit: laborDeficit,
				laborMinutesTotalDemand: laborDemand,
				laborCostForDeficit: costDeficit,
				laborCostTotalDemand: costDemand
			});

			const summary = recipeSummaries[productItem.id];
			const nodes = summary?.nodes ?? [];
			const yieldQty = productItem.yieldQuantity > 0 ? productItem.yieldQuantity : 1;
			const batchesNeeded = totalOrderedQty / yieldQty;

			for (const node of nodes) {
				const comp = node.component;
				const reqInBase = convertQuantity(
					node.quantity * batchesNeeded,
					node.unit,
					comp.baseUnit
				);

				if (comp.type === 'prepared') {
					subAssemblyRequiredMap.set(
						comp.id,
						(subAssemblyRequiredMap.get(comp.id) ?? 0) + reqInBase
					);
				} else {
					directRawRequiredMap.set(
						comp.id,
						(directRawRequiredMap.get(comp.id) ?? 0) + reqInBase
					);
				}
			}
		}

		// 2. Construir previsión de Sub-ensambles multinivel (N-niveles) y Materias Primas
		const subAssemblyForecast: PreorderForecastLine[] = [];
		const subAssemblyTotalDemandMap = new Map<string, number>();
		const subAssemblyRemainingStock = new Map<string, number>();
		const subAssemblyTotalDeficitMap = new Map<string, number>();
		const totalRawRequiredMap = new Map<string, number>(directRawRequiredMap);

		// Cola para explosión multinivel (BFS)
		const subAssemblyQueue: Array<{ itemId: string; reqQty: number }> = [];
		for (const [subId, reqQty] of subAssemblyRequiredMap.entries()) {
			subAssemblyQueue.push({ itemId: subId, reqQty });
		}

		let safetyLoopCounter = 0;
		const MAX_EXPLOSION_ITERATIONS = 1000;

		while (subAssemblyQueue.length > 0 && safetyLoopCounter < MAX_EXPLOSION_ITERATIONS) {
			safetyLoopCounter++;
			const itemToProcess = subAssemblyQueue.shift();
			if (!itemToProcess) break;
			const { itemId, reqQty } = itemToProcess;
			const subItem = itemsById.get(itemId);
			if (!subItem) continue;

			// Acumular demanda bruta total de este elaborado
			subAssemblyTotalDemandMap.set(
				itemId,
				(subAssemblyTotalDemandMap.get(itemId) ?? 0) + reqQty
			);

			// Si es un producto Make-to-Order (a demanda, sin stock almacenable), se produce siempre el 100% requerido
			const isMakeToOrder = Boolean(subItem.recipeConfig?.isMakeToOrder);

			let deficitPortion = 0;
			if (isMakeToOrder) {
				deficitPortion = reqQty;
			} else {
				// Consultar stock remanente para ver cuánto cubre este requerimiento
				const availableStock = subAssemblyRemainingStock.has(itemId)
					? subAssemblyRemainingStock.get(itemId)!
					: subItem.currentStock;

				if (availableStock >= reqQty) {
					subAssemblyRemainingStock.set(itemId, availableStock - reqQty);
				} else {
					deficitPortion = reqQty - availableStock;
					subAssemblyRemainingStock.set(itemId, 0);
				}
			}

			// Si hay déficit, necesitamos fabricar esta porción y por tanto explotar su receta
			if (deficitPortion > 0) {
				subAssemblyTotalDeficitMap.set(
					itemId,
					(subAssemblyTotalDeficitMap.get(itemId) ?? 0) + deficitPortion
				);

				const subSummary = recipeSummaries[itemId];
				const subNodes = subSummary?.nodes ?? [];
				const subYield = subItem.yieldQuantity > 0 ? subItem.yieldQuantity : 1;
				const batchesForDeficit = deficitPortion / subYield;

				for (const node of subNodes) {
					const childComp = node.component;
					const childReqInBase = convertQuantity(
						node.quantity * batchesForDeficit,
						node.unit,
						childComp.baseUnit
					);

					if (childComp.type === 'raw_material') {
						totalRawRequiredMap.set(
							childComp.id,
							(totalRawRequiredMap.get(childComp.id) ?? 0) + childReqInBase
						);
					} else if (childComp.type === 'prepared') {
						// Sub-ensamble anidado (Nivel 2, Nivel 3...): se encola para calcular stock, demanda y mano de obra
						subAssemblyQueue.push({
							itemId: childComp.id,
							reqQty: childReqInBase
						});
					}
				}
			}
		}

		for (const [subId, reqQty] of subAssemblyTotalDemandMap.entries()) {
			const subItem = itemsById.get(subId);
			if (!subItem) continue;

			const isMakeToOrder = Boolean(subItem.recipeConfig?.isMakeToOrder);
			const projectedBalance = isMakeToOrder ? 0 : Number((subItem.currentStock - reqQty).toFixed(3));
			const deficitQuantity = isMakeToOrder
				? reqQty
				: (subAssemblyTotalDeficitMap.get(subId) ?? (projectedBalance < 0 ? Math.abs(projectedBalance) : 0));
			const isShortage = !isMakeToOrder && deficitQuantity > 0;

			const {
				laborMinutes: laborDeficit,
				activeMinutes: subActiveDeficit,
				passiveMinutes: subPassiveDeficit,
				batchesNeeded: batchesDeficit,
				laborCost: subCostDeficit
			} = calcLaborForItem(subItem, deficitQuantity);

			const {
				laborMinutes: laborDemand,
				laborCost: subCostDemand
			} = calcLaborForItem(subItem, reqQty);

			subAssemblyForecast.push({
				itemId: subItem.id,
				code: subItem.code,
				name: subItem.name,
				type: subItem.type,
				baseUnit: subItem.baseUnit,
				currentStock: subItem.currentStock,
				minStock: subItem.minStock,
				requiredQuantity: Number(reqQty.toFixed(3)),
				projectedBalance,
				deficitQuantity: Number(deficitQuantity.toFixed(3)),
				isShortage,
				isMakeToOrder,
				prepTimeMinutes: subItem.prepTimeMinutes,
				passiveTimeMinutes: subItem.passiveTimeMinutes,
				isPrepTimeScalable: subItem.isPrepTimeScalable,
				yieldQuantity: subItem.yieldQuantity,
				batchesNeededForDeficit: batchesDeficit,
				laborMinutesForDeficit: laborDeficit,
				laborMinutesTotalDemand: laborDemand,
				laborCostForDeficit: subCostDeficit,
				laborCostTotalDemand: subCostDemand
			});
		}

		// Ordenar primero los que tienen déficit
		subAssemblyForecast.sort((a, b) => {
			if (a.isShortage !== b.isShortage) return a.isShortage ? -1 : 1;
			return a.projectedBalance - b.projectedBalance;
		});

		const rawMaterialForecast: PreorderForecastLine[] = [];
		for (const [rawId, reqQty] of totalRawRequiredMap.entries()) {
			const rawItem = itemsById.get(rawId);
			if (!rawItem) continue;

			const projectedBalance = Number((rawItem.currentStock - reqQty).toFixed(3));
			const deficitQuantity = projectedBalance < 0 ? Math.abs(projectedBalance) : 0;

			rawMaterialForecast.push({
				itemId: rawItem.id,
				code: rawItem.code,
				name: rawItem.name,
				type: rawItem.type,
				baseUnit: rawItem.baseUnit,
				currentStock: rawItem.currentStock,
				minStock: rawItem.minStock,
				requiredQuantity: Number(reqQty.toFixed(3)),
				projectedBalance,
				deficitQuantity: Number(deficitQuantity.toFixed(3)),
				isShortage: deficitQuantity > 0,
				prepTimeMinutes: rawItem.prepTimeMinutes,
				isPrepTimeScalable: rawItem.isPrepTimeScalable,
				yieldQuantity: rawItem.yieldQuantity,
				batchesNeededForDeficit: 0,
				laborMinutesForDeficit: 0,
				laborMinutesTotalDemand: 0
			});
		}

		rawMaterialForecast.sort((a, b) => {
			if (a.isShortage !== b.isShortage) return a.isShortage ? -1 : 1;
			return a.projectedBalance - b.projectedBalance;
		});

		// Cálculo de tiempo: Activo (humano/operario), Pasivo (máquina/espera) y Ruta Crítica (paralelo)
		let totalActiveMinutesForDeficit = 0;
		let totalPassiveMinutesForDeficit = 0;
		let maxSubAssemblyLeadTime = 0;

		for (const p of productDemands) {
			const item = itemsById.get(p.itemId);
			const { activeMinutes, passiveMinutes } = item
				? calcLaborForItem(item, p.deficitQuantity)
				: calcLaborLegacy(
						p.deficitQuantity,
						p.prepTimeMinutes,
						p.passiveTimeMinutes,
						p.yieldQuantity,
						p.isPrepTimeScalable
					);
			totalActiveMinutesForDeficit += activeMinutes;
			totalPassiveMinutesForDeficit += passiveMinutes;
		}

		for (const s of subAssemblyForecast) {
			const item = itemsById.get(s.itemId);
			const { activeMinutes, passiveMinutes, laborMinutes } = item
				? calcLaborForItem(item, s.deficitQuantity)
				: calcLaborLegacy(
						s.deficitQuantity,
						s.prepTimeMinutes,
						s.passiveTimeMinutes,
						s.yieldQuantity,
						s.isPrepTimeScalable
					);
			totalActiveMinutesForDeficit += activeMinutes;
			totalPassiveMinutesForDeficit += passiveMinutes;
			if (laborMinutes > maxSubAssemblyLeadTime) {
				maxSubAssemblyLeadTime = laborMinutes;
			}
		}

		const totalLaborMinutesForDeficit = totalActiveMinutesForDeficit + totalPassiveMinutesForDeficit;

		// Ruta Crítica (Lead Time en paralelo):
		// Las manos del pastelero son secuenciales (totalActiveMinutesForDeficit), pero el tiempo pasivo
		// de cocción/frío se solapa concurrentemente con la mano de obra.
		// Tiempo mínimo de entrega = Mano de obra activa total + el tiempo pasivo que no pudo ser solapado.
		const criticalPathMinutesForDeficit = Math.max(
			totalActiveMinutesForDeficit,
			Math.round(totalActiveMinutesForDeficit + (totalPassiveMinutesForDeficit > totalActiveMinutesForDeficit ? totalPassiveMinutesForDeficit - totalActiveMinutesForDeficit : 0))
		);

		const totalLaborMinutesTotalDemand =
			subAssemblyForecast.reduce((acc, i) => acc + (i.laborMinutesTotalDemand ?? 0), 0) +
			productDemands.reduce((acc, p) => acc + (p.laborMinutesTotalDemand ?? 0), 0);

		const totalLaborCostForDeficit =
			subAssemblyForecast.reduce((acc, i) => acc + (i.laborCostForDeficit ?? 0), 0) +
			productDemands.reduce((acc, p) => acc + (p.laborCostForDeficit ?? 0), 0);

		const totalLaborCostTotalDemand =
			subAssemblyForecast.reduce((acc, i) => acc + (i.laborCostTotalDemand ?? 0), 0) +
			productDemands.reduce((acc, p) => acc + (p.laborCostTotalDemand ?? 0), 0);

		return {
			pendingOrdersCount: pendingOrders.length,
			pendingPreorderLinesCount,
			productDemands,
			subAssemblyForecast,
			rawMaterialForecast,
			totalLaborMinutesForDeficit,
			totalLaborMinutesTotalDemand,
			totalActiveMinutesForDeficit,
			totalPassiveMinutesForDeficit,
			criticalPathMinutesForDeficit,
			totalLaborCostForDeficit: Math.round(totalLaborCostForDeficit * 100) / 100,
			totalLaborCostTotalDemand: Math.round(totalLaborCostTotalDemand * 100) / 100
		};
	}
}
