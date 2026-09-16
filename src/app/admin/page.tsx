"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Tesseract from "tesseract.js";
import { Upload, FileText, Save, Trash2, Plus, LogOut, Loader2, Image as ImageIcon } from "lucide-react";

type DraftShipment = {
  id: string;
  tracking_code: string;
  recipient_name: string;
};

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);
  
  // Auth states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // Panel states
  const [drafts, setDrafts] = useState<DraftShipment[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [rawOcrText, setRawOcrText] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || "Kimlik doğrulama hatası.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- OCR Processing ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrProgress(0);
    setRawOcrText("");

    try {
      const result = await Tesseract.recognize(file, 'tur', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });
      
      setRawOcrText(result.data.text);
      parseAndAddDrafts(result.data.text);
    } catch (err) {
      console.error(err);
      alert("OCR işlemi sırasında bir hata oluştu.");
    } finally {
      setOcrLoading(false);
      if (e.target) e.target.value = ''; // reset input
    }
  };

  const parseAndAddDrafts = (text: string) => {
    console.log("--- RAW OCR TEXT ---");
    console.log(text);
    console.log("--------------------");

    const lines = text.split('\n');
    const newDrafts: DraftShipment[] = [];

    // Esnek 12 Haneli Regex: Başı ve sonu boşluk/satır başı ile sınırlı, 
    // içinde sadece rakam ve O/o harfi olan, aralarında isteğe bağlı boşluklar olan tam 12 karakterlik blok.
    const trackingRegex = /(?:^|\s)((?:[0-9Oo]\s*){12})(?=\s|$)/i;

    lines.forEach(line => {
      const match = line.match(trackingRegex);
      if (match) {
        const rawCodeMatch = match[1]; // Sadece yakalanan kod kısmı (boşluklu veya O/o'lu olabilir)
        
        // Kodu temizle: Tüm boşlukları kaldır, O ve o harflerini 0 yap
        const trackingCode = rawCodeMatch.replace(/\s+/g, '').replace(/[Oo]/g, '0');
        
        // Kodu satırdan çıkarıp kalan kısmı isim olarak kabul ediyoruz (temizleme yaparak)
        let namePart = line.replace(rawCodeMatch, '').trim();
        // İsimdeki fazla boşlukları ve gereksiz noktalama işaretlerini temizle
        namePart = namePart.replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim();
        
        newDrafts.push({
          id: Math.random().toString(36).substring(7),
          tracking_code: trackingCode,
          recipient_name: namePart || "Bilinmiyor",
        });
      }
    });

    console.log("--- PARSED DRAFTS ---", newDrafts);

    if (newDrafts.length > 0) {
      setDrafts(prev => [...prev, ...newDrafts]);
    } else {
      alert("Bu metinde geçerli bir gönderi kodu (12 haneli sayı) bulunamadı.");
    }
  };

  const handleBulkTextProcess = () => {
    if (!bulkText.trim()) return;
    
    // Sürekli Metin (Continuous Text) Ayrıştırma Mantığı
    // \d*? => baştaki liste no vb. atlar
    // (\d{12}) => tam 12 haneli kargo kodu (Grup 1)
    // (?!\d) => kargo kodundan hemen sonra başka rakam olmamasını garantiler
    // (.*?) => Sonraki kargo koduna kadar olan tüm karakterler (Grup 2 - İsim)
    const regex = /\d*?(\d{12})(?!\d)(.*?)(?=\d*?\d{12}(?!\d)|$)/gs;
    const newDrafts: DraftShipment[] = [];

    let match;
    while ((match = regex.exec(bulkText)) !== null) {
      const trackingCode = match[1];
      let customerName = match[2];

      // İsim kısmındaki özel karakterleri ve satır atlamalarını temizle
      customerName = customerName.replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim();

      newDrafts.push({
        id: Math.random().toString(36).substring(7),
        tracking_code: trackingCode,
        recipient_name: customerName || "Bilinmiyor",
      });
    }

    if (newDrafts.length > 0) {
      setDrafts(prev => [...prev, ...newDrafts]);
      setBulkText(""); // Textarea'yı temizle
    } else {
      alert("Yapıştırılan metinde uygun formatta (12 haneli) kargo kodu bulunamadı.");
    }
  };

  const updateDraft = (id: string, field: keyof DraftShipment, value: string) => {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const removeDraft = (id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
  };

  const addNewEmptyDraft = () => {
    setDrafts(prev => [...prev, { id: Math.random().toString(36).substring(7), tracking_code: "", recipient_name: "" }]);
  };

  const handleSaveToDatabase = async () => {
    // Kodu ve adı dolu olanları filtrele
    const validDrafts = drafts.filter(d => d.tracking_code.trim() && d.recipient_name.trim());
    
    if (validDrafts.length === 0) {
      alert("Kaydedilecek geçerli veri yok. Lütfen Kargo Kodu ve Alıcı Adı alanlarını doldurun.");
      return;
    }

    // 12 Haneli Regex Kontrolü
    const regex12 = /^\d{12}$/;
    const invalidCodes = validDrafts.filter(d => !regex12.test(d.tracking_code.trim()));
    if (invalidCodes.length > 0) {
      alert(`Hata: ${invalidCodes.length} adet kargo kodu 12 haneli rakam formatına uymuyor.\nÖrn: ${invalidCodes[0].tracking_code}`);
      return;
    }

    setSaving(true);
    try {
      const trackingCodes = validDrafts.map(d => d.tracking_code.trim());

      // Mükerrer Kayıt (Duplicate) Kontrolü
      const { data: existingData, error: fetchError } = await supabase
        .from('shipments')
        .select('tracking_code')
        .in('tracking_code', trackingCodes);

      if (fetchError) throw fetchError;

      if (existingData && existingData.length > 0) {
        const existingCodes = existingData.map(e => e.tracking_code);
        alert(`Hata: Veritabanında zaten kayıtlı olan kodlar var! Lütfen listeden çıkarın:\n\n${existingCodes.join('\n')}`);
        setSaving(false);
        return;
      }

      const inserts = validDrafts.map(d => ({
        tracking_code: d.tracking_code.trim(),
        recipient_name: d.recipient_name.trim(),
        carrier: "Yurtiçi Kargo", // varsayılan
        status: "active"
      }));

      const { error } = await supabase.from('shipments').insert(inserts);

      if (error) throw error;

      alert(`${validDrafts.length} adet kargo başarıyla kaydedildi!`);
      // Temizle
      setDrafts([]);
    } catch (err: any) {
      console.error(err);
      alert("Kaydetme işlemi sırasında hata: " + err.message);
    } finally {
      setSaving(false);
    }
  };


  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">Admin Girişi</h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            
            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition flex justify-center items-center"
            >
              {authLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Giriş Yap"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Yönetim Paneli</h1>
            <p className="text-gray-500 text-sm">Görselden veya manuel metinden kargo girişlerini yapın.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 font-medium">{session.user.email}</span>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
            >
              <LogOut className="h-4 w-4" />
              Çıkış
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Yöntem 1: OCR */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 rounded-lg"><ImageIcon className="text-blue-600 h-5 w-5" /></div>
              <h2 className="text-lg font-semibold">Görsel Yükle & Tara (OCR)</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Kağıt faturasının fotoğrafını yükleyerek 12 haneli takip kodlarını ve alıcı isimlerini otomatik çekin.
            </p>
            
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {ocrLoading ? (
                  <>
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                    <p className="text-sm text-gray-500 font-medium">Taranıyor... %{ocrProgress}</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500"><span className="font-semibold text-blue-600">Görsel seç</span> veya sürükle bırak</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={ocrLoading} />
            </label>
          </div>

          {/* Yöntem 2: Manuel Metin */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-50 rounded-lg"><FileText className="text-purple-600 h-5 w-5" /></div>
              <h2 className="text-lg font-semibold">Manuel / Toplu Metin Ekleme</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Eğer OCR hatalı okursa, verileri kopyala yapıştır ile buraya girin. Satır satır okuyacaktır.
            </p>
            
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder="Örn:&#10;123456789012 Emir Yılmaz&#10;987654321098 Ayşe Kaya"
              className="w-full h-24 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none text-sm"
            />
            <button
              onClick={handleBulkTextProcess}
              className="mt-3 w-full bg-purple-50 text-purple-700 hover:bg-purple-100 py-2 rounded-lg font-medium transition text-sm"
            >
              Metni Ayıkla ve Tabloya Ekle
            </button>
          </div>
        </div>

        {/* Hata Ayıklama (Debug View) */}
        {rawOcrText && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-2 text-gray-900">Hata Ayıklama (Raw OCR Text)</h2>
            <p className="text-sm text-gray-500 mb-4">OCR'ın kağıttan veya görselden direkt okuduğu ham metin aşağıdadır.</p>
            <textarea
              readOnly
              value={rawOcrText}
              className="w-full h-32 p-3 border border-gray-200 rounded-xl bg-gray-50 text-xs font-mono outline-none resize-y"
            />
          </div>
        )}

        {/* Onay Tablosu */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold">Onay Tablosu ({drafts.length} Kayıt)</h2>
              <p className="text-sm text-gray-500">Verileri veritabanına kaydetmeden önce hataları düzeltin.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={addNewEmptyDraft}
                className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
              >
                <Plus className="h-4 w-4" /> Satır Ekle
              </button>
              <button
                onClick={handleSaveToDatabase}
                disabled={saving || drafts.length === 0}
                className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Toplu Kaydet
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-100">
                  <th className="p-4 font-medium">Gönderi Kodu (12 Hane)</th>
                  <th className="p-4 font-medium">Alıcı Ad Soyad</th>
                  <th className="p-4 font-medium w-16 text-center">Sil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {drafts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-400">
                      Henüz eklenecek veri yok. Yukarıdan görsel taratın veya metin yapıştırın.
                    </td>
                  </tr>
                ) : (
                  drafts.map(draft => (
                    <tr key={draft.id} className="hover:bg-gray-50 transition">
                      <td className="p-2">
                        <input
                          type="text"
                          value={draft.tracking_code}
                          onChange={e => updateDraft(draft.id, 'tracking_code', e.target.value)}
                          placeholder="123456789012"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={draft.recipient_name}
                          onChange={e => updateDraft(draft.id, 'recipient_name', e.target.value)}
                          placeholder="Alıcı Ad Soyad"
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => removeDraft(draft.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Satırı Sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
