/** Minimal Square Catalog API shapes used for menu import. */

export type SquareCatalogMoney = {
  amount?: number;
  currency?: string;
};

export type SquareCatalogObject = {
  type: string;
  id: string;
  is_deleted?: boolean;
  present_at_all_locations?: boolean;
  present_at_location_ids?: string[];
  absent_at_location_ids?: string[];
  category_data?: {
    name?: string;
  };
  item_data?: {
    name?: string;
    description?: string;
    categories?: Array<{ id?: string }>;
    image_ids?: string[];
    modifier_list_info?: Array<{
      modifier_list_id?: string;
      min_selected_modifiers?: number;
      max_selected_modifiers?: number;
      enabled?: boolean;
    }>;
    variations?: Array<{ id?: string; type?: string }>;
  };
  item_variation_data?: {
    name?: string;
    item_id?: string;
    pricing_type?: string;
    price_money?: SquareCatalogMoney;
    location_overrides?: Array<{
      location_id?: string;
      price_money?: SquareCatalogMoney;
      sold_out?: boolean;
    }>;
  };
  modifier_list_data?: {
    name?: string;
    selection_type?: string;
    modifiers?: Array<{ id?: string; type?: string }>;
  };
  modifier_data?: {
    name?: string;
    price_money?: SquareCatalogMoney;
    modifier_list_id?: string;
  };
  image_data?: {
    url?: string;
    name?: string;
  };
};

export type SquareCatalogListResponse = {
  objects?: SquareCatalogObject[];
  cursor?: string;
  errors?: Array<{ detail?: string }>;
};

export const SQUARE_CATALOG_LIST_TYPES = [
  "CATEGORY",
  "ITEM",
  "ITEM_VARIATION",
  "MODIFIER_LIST",
  "MODIFIER",
  "IMAGE",
] as const;
