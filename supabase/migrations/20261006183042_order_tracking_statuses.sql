alter type public.order_status add value if not exists 'ready_pickup';
alter type public.order_status add value if not exists 'ready_shipment';
alter type public.order_status add value if not exists 'in_transit';
alter type public.order_status add value if not exists 'delivered';
