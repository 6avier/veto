export default function PrintableWaybill({ form }) {
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="w-full max-w-[210mm] mx-auto bg-white text-black p-8 text-[12pt] font-sans">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">NUSANTARA WMS</h1>
          <p className="text-sm mt-1 text-gray-700">
            Kawasan Industri Terpadu Cikarang Blok A-1<br />
            Telp: (021) 8989-1234 | Email: dispatch@nusantarawms.co.id
          </p>
        </div>
        <div className="text-right flex-1 border-l-2 border-black pl-4">
          <h2 className="text-xl font-bold uppercase underline">Surat Jalan Logistik</h2>
          <p className="font-semibold mt-1">Nomor: {form?.dispatchRef || 'DO-XXXX-XXXX'}</p>
          <p className="text-sm mt-1">Tanggal: {today}</p>
        </div>
      </div>

      <p className="mb-4">
        Yang bertandatangan di bawah ini menerangkan bahwa kendaraan angkutan barang dengan rincian di bawah ini telah 
        melewati proses verifikasi batas muatan dan dimensi (VETO) dan diizinkan untuk melakukan bongkar/muat:
      </p>

      {/* Table Detail */}
      <table className="w-full border-collapse border border-black mb-6">
        <tbody>
          <tr>
            <td className="border border-black p-2 font-semibold bg-gray-100 w-1/4">Tujuan / Asal</td>
            <td className="border border-black p-2 w-1/4">Gudang Cikarang 01</td>
            <td className="border border-black p-2 font-semibold bg-gray-100 w-1/4">Status Verifikasi</td>
            <td className="border border-black p-2 font-bold text-green-700">LULUS (PASS)</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold bg-gray-100">Konfigurasi Sumbu</td>
            <td className="border border-black p-2">{form?.axleConfig || '-'}</td>
            <td className="border border-black p-2 font-semibold bg-gray-100">Berat Kosong</td>
            <td className="border border-black p-2">{form?.tareWeight ? `${form.tareWeight} kg` : '-'}</td>
          </tr>
          <tr>
            <td className="border border-black p-2 font-semibold bg-gray-100">Berat Kotor (JBI)</td>
            <td className="border border-black p-2">{form?.grossWeight ? `${form.grossWeight} kg` : '-'}</td>
            <td className="border border-black p-2 font-semibold bg-gray-100">Dimensi (P x L x T)</td>
            <td className="border border-black p-2">
              {form?.length || 0} x {form?.width || 0} x {form?.height || 0} mm
            </td>
          </tr>
        </tbody>
      </table>

      {/* Rincian Sumbu */}
      <h3 className="font-bold mb-2">Rincian Beban Sumbu (Axle Loads):</h3>
      <table className="w-full border-collapse border border-black mb-6">
        <thead>
          <tr className="bg-gray-100">
            {form?.axleLoads?.map((_, idx) => (
              <th key={idx} className="border border-black p-2 text-center">Sumbu {idx + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {form?.axleLoads?.map((load, idx) => (
              <td key={idx} className="border border-black p-2 text-center">
                {load ? `${load} kg` : '-'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <p className="mb-12">
        Demikian surat jalan ini dicetak secara otomatis oleh Sistem VETO sebagai dokumen sah izin melintas 
        dan bongkar muat di lingkungan Nusantara WMS. Segala bentuk manipulasi data pada surat ini dapat berakibat 
        pada sanksi sesuai hukum yang berlaku.
      </p>

      {/* Signatures */}
      <div className="flex justify-between mt-8 text-center">
        <div className="w-1/3">
          <p className="mb-20">Pengemudi,</p>
          <p className="font-bold underline">_________________________</p>
          <p className="text-sm">Nama Terang & Tanda Tangan</p>
        </div>
        <div className="w-1/3">
          <p className="mb-20">Petugas Dispatch (VETO),</p>
          <p className="font-bold underline">SISTEM OTOMATIS</p>
          <p className="text-sm">Tervalidasi Digital</p>
        </div>
      </div>
    </div>
  )
}
