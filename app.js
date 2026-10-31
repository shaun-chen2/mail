const $ = (id) => document.getElementById(id);

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* 忽略解析错误 */ }
  return { ok: res.ok, status: res.status, data };
}

const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

async function init() {
  const { data } = await api('/api/me');
  if (data.loggedIn) {
    hide($('auth'));
    show($('compose'));
    $('fromLine').textContent = '发件人（系统统一邮箱）' +
      (data.email ? '，回复地址：' + data.email : '');
    renderUserbar(data);
  } else {
    show($('auth'));
    hide($('compose'));
  }
}

function renderUserbar(data) {
  const bar = $('userbar');
  bar.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = '👤 ' + data.username + (data.role === 'admin' ? '（管理员）' : '');
  bar.appendChild(span);
  if (data.role === 'admin') {
    const a = document.createElement('a');
    a.href = '/admin.html';
    a.className = 'linkbtn';
    a.textContent = '管理后台';
    bar.appendChild(a);
  }
  const out = document.createElement('button');
  out.className = 'linkbtn';
  out.textContent = '退出';
  out.onclick = logout;
  bar.appendChild(out);
}

// 标签页切换
document.querySelectorAll('.tab').forEach((t) => {
  t.onclick = () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    if (t.dataset.tab === 'login') {
      show($('loginForm')); hide($('registerForm'));
    } else {
      hide($('loginForm')); show($('registerForm'));
    }
  };
});

// 登录
$('loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const r = await api('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username: $('loginUser').value, password: $('loginPass').value }),
  });
  if (r.ok) location.reload();
  else $('authStatus').textContent = r.data.error || '登录失败';
};

// 注册
$('registerForm').onsubmit = async (e) => {
  e.preventDefault();
  const r = await api('/api/register', {
    method: 'POST',
    body: JSON.stringify({
      username: $('regUser').value,
      password: $('regPass').value,
      inviteCode: $('regCode').value,
      email: $('regEmail').value,
    }),
  });
  if (r.ok) {
    $('authStatus').textContent = '✅ 注册成功，请登录';
    document.querySelectorAll('.tab')[0].click();
    $('registerForm').reset();
  } else {
    $('authStatus').textContent = '❌ ' + (r.data.error || '注册失败');
  }
};

// 发信
$('sendForm').onsubmit = async (e) => {
  e.preventDefault();
  $('sendBtn').disabled = true;
  $('sendStatus').textContent = '发送中…';
  const r = await api('/api/send', {
    method: 'POST',
    body: JSON.stringify({
      to: $('to').value,
      subject: $('subject').value,
      body: $('body').value,
    }),
  });
  if (r.ok) {
    $('sendStatus').textContent = '✅ 发送成功';
    $('sendForm').reset();
  } else {
    $('sendStatus').textContent = '❌ ' + (r.data.error || '发送失败');
  }
  $('sendBtn').disabled = false;
};

async function logout() {
  await api('/api/logout', { method: 'POST' });
  location.reload();
}

init();
