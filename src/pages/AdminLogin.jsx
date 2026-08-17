import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, message, Alert } from 'antd';
import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../components/layout/ThemeProvider';
import logoLight from '../assets/brand/vibra-logo-light.png';
import logoDark from '../assets/brand/vibra-logo-dark.png';
import './AdminLogin.css';

export default function AdminLogin() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { login, logout } = useAuth();
  const { theme } = useTheme();

  const handleSubmit = async (values) => {
    setLoading(true);
    setError(null);
    try {
      const user = await login({ email: values.email, password: values.password });
      // BOLETERIA incluida: tiene UI propia adentro del panel (BoxOffice) y el
      // router la admite; excluirla acá dejaba al boletero sin poder entrar.
      const allowedRoles = ['ADMIN', 'ORGANIZER', 'PRODUCER', 'DOOR', 'BOLETERIA'];
      if (!allowedRoles.includes(user.role)) {
        setError('Este acceso es solo para administradores, organizadores y personal autorizado.');
        message.error('Acceso denegado. Usá el login de clientes.');
        await logout();
        return;
      }
      message.success(`Bienvenido ${user.name || user.email}`);
      navigate('/admin');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al iniciar sesión.';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const year = new Date().getFullYear();

  return (
    <div className="adm-login">
      <section className="adm-login__form">
        <div className="adm-login__brand">
          <img
            src={theme === 'light' ? logoDark : logoLight}
            alt="Vibra Tickets"
            style={{ height: 44, width: 'auto' }}
          />
        </div>

        <div className="adm-login__center">
          <div className="adm-login__eyebrow">control room · v3</div>
          <h1 className="adm-login__title">
            Lo que pasa<br />
            <em>detrás</em> del show.
          </h1>
          <p className="adm-login__lede">
            Dashboards en tiempo real. Decisiones en segundos. Una sola consola, todo el ecosistema.
          </p>

          {error && (
            <Alert
              message="No se pudo iniciar sesión"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form form={form} layout="vertical" onFinish={handleSubmit} size="large" requiredMark={false}>
            <Form.Item
              label="Email"
              name="email"
              rules={[
                { required: true, message: 'Ingresá tu email' },
                { type: 'email', message: 'Email inválido' },
              ]}
            >
              <Input placeholder="staff@vibratickets.com" autoComplete="email" />
            </Form.Item>

            <Form.Item
              label="Contraseña"
              name="password"
              rules={[{ required: true, message: 'Ingresá tu contraseña' }]}
            >
              <Input.Password placeholder="•••••••••••" autoComplete="current-password" />
            </Form.Item>

            <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 18 }}>
              <Checkbox>Mantener la sesión abierta</Checkbox>
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="adm-login__submit"
                icon={!loading && <ArrowRight size={16} strokeWidth={2} />}
                iconPosition="end"
              >
                Entrar al control room
              </Button>
            </Form.Item>

            <div className="adm-login__links">
              <Link to="/forgot-password">Olvidé mi contraseña</Link>
              <span>
                {/* El login de clientes vive en el sitio público, no en este router */}
                ¿Cliente? <a href="https://vibratickets.com/customerlogin">Acceso público</a>
              </span>
            </div>
          </Form>
        </div>

        <div className="adm-login__foot">© {year} · Vibra Tickets Admin · v3 vibra build</div>
      </section>

      <aside className="adm-login__art">
        <span className="adm-login__art-chip">en vivo · operación abierta</span>

        <p className="adm-login__art-quote">
          Tu show.<br />
          <em>Tu data.</em><br />
          <span className="cy">En vivo.</span>
        </p>

        <div className="adm-login__art-meta">
          <div>uptime<b>99.98%</b></div>
          <div>volumen<b>$ 4.2M / mes</b></div>
          <div>nodos<b>BA · MAD · MIA</b></div>
        </div>
      </aside>
    </div>
  );
}
