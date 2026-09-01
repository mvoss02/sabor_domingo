alter table settings add constraint positive_prices check (price_4 > 0 and price_10 > 0 and order_fee >= 0 and max_packs > 0);
