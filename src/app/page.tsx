"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Package, ExternalLink, Calendar } from "lucide-react";

type Shipment = {
  id: string;
  tracking_code: string;
  recipient_name: string;
  recipient_phone_last4?: string;
  carrier: string;
  created_at: string;
  status: string;
};

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError("");
    setHasSearched(true);
    
    try {
      // Supabase RPC çağrısı ile özel fonksiyonumuzu kullanıyoruz
      // unaccent ve ILIKE barındıran fonksiyon
      const { data, error: rpcError } = await supabase
        .rpc("search_shipments_by_name", { search_term: searchQuery.trim().replace(/\s+/g, ' ') });

      if (rpcError) {
        throw rpcError;
      }

      setShipments(data || []);
    } catch (err: any) {
      console.error(err);
      setError("Kargo bilgileri getirilirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
            Kargo Takip Sistemi
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            Adınızı ve soyadınızı girerek size ait kargoları hızlıca sorgulayın.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <form onSubmit={handleSearch} className="relative">
            <div className="relative flex items-center">
              <Search className="absolute left-4 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Örn: Emir Yılmaz"
                className="block w-full pl-12 pr-32 py-4 text-gray-900 border-2 border-gray-100 rounded-xl bg-gray-50 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-lg"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-2 top-2 bottom-2 px-6 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                {loading ? "Aranıyor..." : "Sorgula"}
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-500 text-center">
              * Türkçe karakter (ı,ş,ö,ğ,ç,ü) kullanmasanız bile sistem isminizi tanır.
            </p>
          </form>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-center">
            {error}
          </div>
        )}

        {hasSearched && !loading && shipments.length === 0 && !error && (
          <div className="p-8 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Kargo Bulunamadı</h3>
            <p className="mt-2 text-gray-500">
              Kargonuz henüz sisteme girilmemiş olabilir, lütfen akşam saatlerinde tekrar deneyiniz veya bizimle iletişime geçiniz.
            </p>
          </div>
        )}

        {shipments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 px-2">Bulunan Kargolarınız</h2>
            {shipments.map((shipment) => (
              <div
                key={shipment.id}
                className="bg-white overflow-hidden rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center">
                        <Package className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 capitalize">
                          {shipment.recipient_name}
                        </h3>
                        <div className="mt-1 flex items-center text-sm text-gray-500 space-x-4">
                          <span className="flex items-center">
                            <span className="font-medium text-gray-700 mr-1">Firma:</span> {shipment.carrier}
                          </span>
                          <span className="flex items-center">
                            <Calendar className="mr-1.5 h-4 w-4 text-blue-500" />
                            <span className="font-medium text-gray-700 mr-1">Gönderi Tarihi:</span> {new Date(shipment.created_at).toLocaleDateString("tr-TR")}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                        {shipment.status === 'active' ? 'Aktif Gönderi' : shipment.status}
                      </span>
                      {shipment.recipient_phone_last4 && (
                        <span className="text-sm font-medium text-gray-500">
                          Son 4 Hane: {shipment.recipient_phone_last4}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-100">
                  <div className="text-sm">
                    <span className="text-gray-500">Takip Kodu: </span>
                    <span className="font-mono font-medium text-gray-900">{shipment.tracking_code}</span>
                  </div>
                  <a
                    href={`https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${shipment.tracking_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-white px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    Yurtiçi Kargo ile Takip Et
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
