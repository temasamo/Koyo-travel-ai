const addresses = [
  { name: '蔵王いろは沼', q: '山形県 上山市 蔵王 いろは沼' },
  { name: '若松観音', q: '山形県 天童市 若松観音 山元2205-1' },
  { name: '熊野大社', q: '山形県 南陽市 熊野大社 宮内3476-1' },
  { name: '恋人の聖地', q: '山形県 上山市 葉山 恋人の聖地' },
  { name: '滑津大滝', q: '宮城県 七ヶ宿町 滑津大滝' },
  { name: '山寺', q: '山形県 山形市 立石寺 山寺' },
  { name: '最上川舟下り', q: '山形県 最上郡 戸沢村 最上川 舟下り' },
  { name: '羽黒山 五重の塔', q: '山形県 鶴岡市 羽黒山 五重塔' },
  { name: '上杉雪灯篭まつり', q: '山形県 米沢市 松が岬公園 上杉雪灯篭まつり' },
  { name: '人間将棋', q: '山形県 天童市 舞鶴山 人間将棋' },
  { name: '狸森珈琲焙煎所', q: '山形県 上山市 狸森1198-8 狸森珈琲焙煎所' },
  { name: 'スモっち', q: '山形県 山形市 くぬぎざわ西3-1 たまごの国 いではこっこ' },
  { name: '山形プリン', q: '山形県 上山市 葉山4-33 山形プリン' },
  { name: '丹野こんにゃく', q: '山形県 上山市 皆沢諏訪前608-1 丹野こんにゃく' },
];
(async () => {
  for (const a of addresses) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=ja&limit=1&q=${encodeURIComponent(a.q)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'koyo-travel-ai (geo@koyoga.com)' }});
    const arr = await r.json();
    const top = arr && arr[0];
    console.log(JSON.stringify({ name: a.name, lat: top?.lat || null, lng: top?.lon || null, display_name: top?.display_name || null }));
    await new Promise(res => setTimeout(res, 1200));
  }
})();
