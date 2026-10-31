const $ = (id) => document.getElementById(id);

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  let data = {};
  try { data = await res.json(); } catch (e) { /* 忽略 */ }
  return { ok: res.ok, data };
}

async function init() {
  const { data } = await api('/api/me');
  if (!data.loggedIn) { location.href = '/'; return; }
  if (data.role !== 'admin') {
    document.body.innerHTML = '<p style="padding:32px;color:#888;">无权限访问该页面。</p>';
    return;
  }
  $('userbar').innerHTML =
    '<span>👤 ' + data.username + '</span>' +
    '<a class="linkbtn" href="/">返回邮箱</a>';
  loadCodes();
}

$('genBtn').onclick = async () => {
  const r = await api('/api/admin/invite', { method: 'POST' });
  if (r.ok) {
    const box = $('newCode');
    box.textContent = '新邀请码：' + r.data.code;
    show(box);
    loadCodes();
  } else {
    $('newCode').textContent = '生成失败：' + (r.data.error || '');
    show($('newCode'));
  }
};

async function loadCodes() {
  const r = await api('/api/admin/codes');
  const tb = $('codesTable').querySelector('tbody');
  tb.innerHTML = '';
  (r.data.codes || []).forEach((c) => {
    const tr = document.createElement('tr');
    const status = c.active && !c.used_by ? '可用' : '已使用';
    tr.innerHTML =
      '<td>' + c.code + '</td>' +
      '<td>' + status + '</td>' +
      '<td>' + new Date(c.created_at).toLocaleString() + '</td>';
    tb.appendChild(tr);
  });
}

const show = (el) => el.classList.remove('hidden');

init();
