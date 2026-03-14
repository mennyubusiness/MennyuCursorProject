# Migration notes: Deliverect-compliant modifiers

## Schema changes

- **MenuItem**: Added `basketMaxQuantity` (optional) for product-level basket limits (multimax).
- **ModifierGroup**: New. `vendorId`, `name`, `minSelections`, `maxSelections`, `isRequired`, `sortOrder`, `isAvailable`, `parentModifierOptionId` (for nested groups).
- **ModifierOption**: New. `modifierGroupId`, `name`, `priceCents`, `sortOrder`, `isDefault`, `isAvailable`.
- **MenuItemModifierGroup**: New. Join table: `menuItemId`, `modifierGroupId`, `required`, `minSelections`, `maxSelections`, `sortOrder`.
- **CartItem**: Unchanged columns. New relation `selections` → CartItemSelection.
- **CartItemSelection**: New. `cartItemId`, `modifierOptionId`, `quantity`. Unique (cartItemId, modifierOptionId).
- **Order**: Added `orderNotes` (optional) for order-level notes.
- **OrderLineItem**: Unchanged columns. New relation `selections` → OrderLineItemSelection.
- **OrderLineItemSelection**: New. `orderLineItemId`, `modifierOptionId`, `nameSnapshot`, `priceCentsSnapshot`, `quantity`.

## Migration steps

1. Run `npx prisma migrate dev --name deliverect_modifiers` (or deploy an existing migration).
2. Run seed to create sample modifier groups and options: `npm run db:seed` (or `npx prisma db seed`).
3. Existing carts and orders continue to work; items without selections behave as before.

## Backward compatibility

- Cart items without selections: subtotal = priceCents * quantity (unchanged).
- Cart items with selections: subtotal = (priceCents + sum(modifier price * modifier qty)) * quantity.
- Order creation: OrderLineItemSelection rows are created only when a cart line has selections; otherwise only OrderLineItem is created.
- Checkout API and flow are unchanged; `orderNotes` is optional and not yet in the checkout form.

## What is ready vs TODO

- **Ready**: Schema, cart/order persistence of selections, order creation with selection snapshots, cart subtotal including modifier prices, domain types.
- **TODO (UI)**: Add-to-cart flow with modifier group UI (required/optional, min/max, nested). Cart page can show selections when present.
- **TODO (validation)**: Enforce modifier min/max and required in `validateCartForOrder`; snooze check (isAvailable); basket limits. Stub in `modifier-validation.ts`.
- **TODO (Deliverect)**: Map MenuItem/ModifierGroup/ModifierOption to Deliverect menu push; map Order + OrderLineItem + OrderLineItemSelection to Deliverect order payload.

## How this maps to Deliverect requirements

| Deliverect requirement | Schema / behavior |
|------------------------|-------------------|
| Modifier groups and modifiers | `ModifierGroup`, `ModifierOption`; per-vendor |
| Quantity of modifiers | `CartItemSelection.quantity`, `OrderLineItemSelection.quantity` |
| Required min/max on groups | `ModifierGroup.minSelections`, `maxSelections`, `isRequired`; overridable per item via `MenuItemModifierGroup` |
| Nested modifiers | `ModifierGroup.parentModifierOptionId` → group appears when parent option is selected |
| Product/modifier info display | Relations from MenuItem → MenuItemModifierGroup → ModifierGroup → ModifierOption; cart/order include selections |
| Updating when menus pushed again | Same IDs or upsert-by-external-id when Deliverect sync is implemented |
| Snoozing products/modifiers | `MenuItem.isAvailable`, `ModifierGroup.isAvailable`, `ModifierOption.isAvailable`; validation TODO |
| Item-level notes | `CartItem.specialInstructions`, `OrderLineItem.specialInstructions` (unchanged) |
| Order-level notes | `Order.orderNotes` |
| Product basket limits (multimax) | `MenuItem.basketMaxQuantity`; validation TODO |
