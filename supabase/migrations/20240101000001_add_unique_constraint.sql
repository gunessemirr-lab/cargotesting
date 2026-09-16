-- Kargo kodlarının mükerrer eklenmesini önlemek için UNIQUE kısıtlaması ekliyoruz
ALTER TABLE shipments ADD CONSTRAINT shipments_tracking_code_unique UNIQUE (tracking_code);
