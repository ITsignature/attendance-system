import React, { useState, useEffect, useCallback } from 'react';
import { Modal, TextInput, Label, Badge } from 'flowbite-react';
import {
  HiDesktopComputer, HiPlus, HiRefresh, HiTrash, HiPencil,
  HiWifi, HiChip, HiLightningBolt, HiCog, HiCheck, HiX,
  HiFingerPrint, HiStatusOnline, HiStatusOffline, HiEye
} from 'react-icons/hi';
import { useDynamicRBAC } from '../RBACSystem/rbacSystem';
import apiService from '../../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Device {
  id: string;
  device_id: string;
  client_id: string;
  client_name?: string;
  name: string;
  location?: string;
  is_online: boolean;
  last_seen?: string;
  last_ip?: string;
  wifi_rssi?: number;
  wifi_ssid?: string;
  free_heap?: number;
  uptime_minutes?: number;
  current_mode?: string;
  firmware_version?: string;
  last_command?: string;
  last_command_at?: string;
  last_command_status?: string;
  last_command_result?: string;
}

interface Client {
  id: string;
  name: string;
}

interface CommandResult {
  success: boolean;
  message: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rssiLabel(rssi?: number): { text: string; color: string } {
  if (!rssi) return { text: 'N/A', color: 'gray' };
  if (rssi >= -50) return { text: 'Excellent', color: 'green' };
  if (rssi >= -60) return { text: 'Good', color: 'blue' };
  if (rssi >= -70) return { text: 'Fair', color: 'yellow' };
  return { text: 'Weak', color: 'red' };
}

function rssiBar(rssi?: number): number {
  if (!rssi) return 0;
  if (rssi >= -50) return 100;
  if (rssi >= -60) return 75;
  if (rssi >= -70) return 50;
  return 25;
}

function formatUptime(minutes?: number): string {
  if (!minutes) return 'N/A';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DeviceManagement: React.FC = () => {
  const { currentUser } = useDynamicRBAC();
  const isSuperAdmin = !!(currentUser?.isSuperAdmin || (currentUser as any)?.is_super_admin);

  const [devices, setDevices] = useState<Device[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected device for control panel
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showControlPanel, setShowControlPanel] = useState(false);

  // Register device modal (super admin only)
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerForm, setRegisterForm] = useState({ device_id: '', client_id: '', name: '', location: '' });
  const [isRegistering, setIsRegistering] = useState(false);

  // Edit device modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', location: '' });
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  // Command state
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null);

  // Command-specific inputs
  const [enrollId, setEnrollId] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newWifiSSID, setNewWifiSSID] = useState('');
  const [newWifiPass, setNewWifiPass] = useState('');

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchDevices = useCallback(async () => {
    try {
      const res = await (apiService as any).get('/api/devices');
      if (res.data?.success) setDevices(res.data.data);
    } catch {
      setError('Failed to load devices');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await (apiService as any).get('/api/clients');
      if (res.data?.success) setClients(res.data.data);
    } catch { /* ignore */ }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchDevices();
    fetchClients();
    // Auto-refresh every 30s to update online status
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, [fetchDevices, fetchClients]);

  // ── Notifications ───────────────────────────────────────────────────────────

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  // ── Register device ─────────────────────────────────────────────────────────

  const handleRegister = async () => {
    if (!registerForm.device_id || !registerForm.client_id || !registerForm.name) {
      showError('Device ID, Client, and Name are required');
      return;
    }
    setIsRegistering(true);
    try {
      const res = await (apiService as any).post('/api/devices', registerForm);
      if (res.data?.success) {
        showSuccess('Device registered successfully');
        setShowRegisterModal(false);
        setRegisterForm({ device_id: '', client_id: '', name: '', location: '' });
        fetchDevices();
      } else {
        showError(res.data?.message || 'Registration failed');
      }
    } catch (e: any) {
      showError(e?.response?.data?.message || 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  // ── Edit device ─────────────────────────────────────────────────────────────

  const openEdit = (device: Device) => {
    setEditingDevice(device);
    setEditForm({ name: device.name, location: device.location || '' });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!editingDevice) return;
    try {
      const res = await (apiService as any).put(`/api/devices/${editingDevice.id}`, editForm);
      if (res.data?.success) {
        showSuccess('Device updated');
        setShowEditModal(false);
        fetchDevices();
      } else {
        showError(res.data?.message || 'Update failed');
      }
    } catch { showError('Update failed'); }
  };

  // ── Delete device ───────────────────────────────────────────────────────────

  const handleDelete = async (device: Device) => {
    if (!confirm(`Delete device "${device.name}" (${device.device_id})? This cannot be undone.`)) return;
    try {
      const res = await (apiService as any).delete(`/api/devices/${device.id}`);
      if (res.data?.success) { showSuccess('Device deleted'); fetchDevices(); }
      else showError(res.data?.message || 'Delete failed');
    } catch { showError('Delete failed'); }
  };

  // ── Send command ────────────────────────────────────────────────────────────

  const sendCommand = async (command: string, params: Record<string, any> = {}) => {
    if (!selectedDevice) return;
    setIsSendingCommand(true);
    setCommandResult(null);
    try {
      const res = await (apiService as any).post(`/api/devices/${selectedDevice.id}/command`, { command, ...params });
      const result = res.data?.result || res.data;
      setCommandResult({ success: result?.success ?? res.data?.success, message: result?.message || res.data?.message || 'Command sent' });
      fetchDevices(); // refresh status
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Command failed or device offline';
      setCommandResult({ success: false, message: msg });
    } finally {
      setIsSendingCommand(false);
    }
  };

  const openControlPanel = (device: Device) => {
    setSelectedDevice(device);
    setCommandResult(null);
    setEnrollId('');
    setDeleteId('');
    setNewBaseUrl(device.last_command === 'update_url' ? '' : '');
    setNewWifiSSID('');
    setNewWifiPass('');
    setShowControlPanel(true);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <HiFingerPrint className="text-blue-600 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Device Management</h1>
            <p className="text-sm text-gray-500">Control fingerprint devices remotely via MQTT</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchDevices} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
            <HiRefresh className="w-4 h-4" /> Refresh
          </button>
          {isSuperAdmin && (
            <button onClick={() => setShowRegisterModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <HiPlus className="w-4 h-4" /> Register Device
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2"><HiX className="w-4 h-4" />{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2"><HiCheck className="w-4 h-4" />{success}</div>}

      {/* Device list */}
      {isLoading ? (
        <div className="text-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto" /></div>
      ) : devices.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <HiDesktopComputer className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No devices registered</p>
          {isSuperAdmin && <p className="text-sm mt-1">Click "Register Device" to add one</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map(device => {
            const rssi = rssiLabel(device.wifi_rssi);
            const bar = rssiBar(device.wifi_rssi);
            return (
              <div key={device.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                {/* Card header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${device.is_online ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <HiDesktopComputer className={`w-5 h-5 ${device.is_online ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{device.name}</p>
                      <p className="text-xs text-gray-500">{device.device_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {device.is_online
                      ? <Badge color="success" icon={HiStatusOnline}>Online</Badge>
                      : <Badge color="gray" icon={HiStatusOffline}>Offline</Badge>
                    }
                  </div>
                </div>

                {/* Stats */}
                <div className="p-4 space-y-2">
                  {isSuperAdmin && device.client_name && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Client</span>
                      <span className="font-medium text-gray-700">{device.client_name}</span>
                    </div>
                  )}
                  {device.location && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Location</span>
                      <span className="font-medium text-gray-700">{device.location}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Last seen</span>
                    <span className="font-medium text-gray-700">{timeAgo(device.last_seen)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Mode</span>
                    <span className={`font-medium capitalize ${device.current_mode === 'enroll' ? 'text-orange-600' : 'text-gray-700'}`}>{device.current_mode || 'attendance'}</span>
                  </div>
                  {device.is_online && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">IP</span>
                        <span className="font-medium text-gray-700">{device.last_ip || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Uptime</span>
                        <span className="font-medium text-gray-700">{formatUptime(device.uptime_minutes)}</span>
                      </div>
                      {/* WiFi signal bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500 flex items-center gap-1"><HiWifi className="w-3 h-3" />WiFi ({device.wifi_ssid || 'N/A'})</span>
                          <span className={`font-medium text-${rssi.color}-600`}>{device.wifi_rssi} dBm · {rssi.text}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full bg-${rssi.color}-500`} style={{ width: `${bar}%` }} />
                        </div>
                      </div>
                    </>
                  )}
                  {device.last_command && (
                    <div className="flex justify-between text-xs pt-1 border-t border-gray-100">
                      <span className="text-gray-500">Last cmd</span>
                      <span className={`font-medium ${device.last_command_status === 'success' ? 'text-green-600' : device.last_command_status === 'failed' ? 'text-red-600' : 'text-yellow-600'}`}>
                        {device.last_command} · {device.last_command_status}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1 p-3 bg-gray-50 border-t border-gray-100">
                  <button onClick={() => openControlPanel(device)} className="flex-1 flex items-center justify-center gap-1 py-2 px-3 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                    <HiCog className="w-3.5 h-3.5" /> Control
                  </button>
                  <button onClick={() => openEdit(device)} className="py-2 px-3 bg-gray-200 text-gray-700 text-xs rounded-lg hover:bg-gray-300">
                    <HiPencil className="w-3.5 h-3.5" />
                  </button>
                  {isSuperAdmin && (
                    <button onClick={() => handleDelete(device)} className="py-2 px-3 bg-red-100 text-red-600 text-xs rounded-lg hover:bg-red-200">
                      <HiTrash className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Control Panel Modal ──────────────────────────────────────────────── */}
      <Modal show={showControlPanel} onClose={() => setShowControlPanel(false)} size="lg">
        <Modal.Header>
          <div className="flex items-center gap-2">
            <HiCog className="w-5 h-5 text-blue-600" />
            Control Panel — {selectedDevice?.name} ({selectedDevice?.device_id})
          </div>
        </Modal.Header>
        <Modal.Body>
          {selectedDevice && (
            <div className="space-y-4">
              {/* Online status banner */}
              {!selectedDevice.is_online && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
                  ⚠️ Device appears offline. Commands will be delivered when it reconnects.
                </div>
              )}

              {/* Command result */}
              {commandResult && (
                <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${commandResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                  {commandResult.success ? <HiCheck className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <HiX className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  {commandResult.message}
                </div>
              )}

              {isSendingCommand && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  Sending command... waiting for device response (up to 30s)
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {/* Mode */}
                <Section title="Mode" icon={<HiLightningBolt className="w-4 h-4" />}>
                  <button disabled={isSendingCommand} onClick={() => sendCommand('set_attendance_mode')} className="cmd-btn bg-green-600 text-white hover:bg-green-700">
                    Set Attendance Mode
                  </button>
                  <button disabled={isSendingCommand} onClick={() => sendCommand('get_status')} className="cmd-btn bg-gray-600 text-white hover:bg-gray-700">
                    Refresh Status
                  </button>
                </Section>

                {/* Fingerprint enrollment */}
                <Section title="Fingerprint Enrollment" icon={<HiFingerPrint className="w-4 h-4" />}>
                  <div className="flex gap-2">
                    <TextInput type="number" min={1} max={127} placeholder="ID (1-127)" value={enrollId} onChange={e => setEnrollId(e.target.value)} className="flex-1" sizing="sm" />
                    <button disabled={isSendingCommand || !enrollId} onClick={() => sendCommand('enroll', { enroll_id: parseInt(enrollId) })} className="cmd-btn bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap">
                      Start Enroll
                    </button>
                  </div>
                </Section>

                {/* Delete fingerprint */}
                <Section title="Delete Fingerprint" icon={<HiTrash className="w-4 h-4" />}>
                  <div className="flex gap-2">
                    <TextInput type="number" min={1} max={127} placeholder="ID (1-127)" value={deleteId} onChange={e => setDeleteId(e.target.value)} className="flex-1" sizing="sm" />
                    <button disabled={isSendingCommand || !deleteId} onClick={() => sendCommand('delete_fp', { delete_id: parseInt(deleteId) })} className="cmd-btn bg-orange-600 text-white hover:bg-orange-700 whitespace-nowrap">
                      Delete
                    </button>
                  </div>
                  <button disabled={isSendingCommand} onClick={() => { if (confirm('Delete ALL fingerprints on this device?')) sendCommand('clear_all'); }} className="cmd-btn bg-red-600 text-white hover:bg-red-700 w-full mt-2">
                    Clear All Fingerprints
                  </button>
                </Section>

                {/* Update BASE URL */}
                <Section title="Update Server URL" icon={<HiChip className="w-4 h-4" />}>
                  <TextInput placeholder="https://your-server.com/api/attendance/fingerprint?client_id=xxx&fingerprint_id=" value={newBaseUrl} onChange={e => setNewBaseUrl(e.target.value)} sizing="sm" />
                  <button disabled={isSendingCommand || !newBaseUrl} onClick={() => sendCommand('update_url', { base_url: newBaseUrl })} className="cmd-btn bg-blue-600 text-white hover:bg-blue-700 w-full mt-2">
                    Update URL
                  </button>
                </Section>

                {/* Update WiFi */}
                <Section title="Update WiFi" icon={<HiWifi className="w-4 h-4" />}>
                  <TextInput placeholder="WiFi SSID" value={newWifiSSID} onChange={e => setNewWifiSSID(e.target.value)} sizing="sm" className="mb-2" />
                  <TextInput type="password" placeholder="WiFi Password" value={newWifiPass} onChange={e => setNewWifiPass(e.target.value)} sizing="sm" />
                  <button disabled={isSendingCommand || !newWifiSSID || !newWifiPass} onClick={() => sendCommand('update_wifi', { ssid: newWifiSSID, password: newWifiPass })} className="cmd-btn bg-blue-600 text-white hover:bg-blue-700 w-full mt-2">
                    Update WiFi
                  </button>
                </Section>

                {/* System actions */}
                <Section title="System" icon={<HiCog className="w-4 h-4" />}>
                  <button disabled={isSendingCommand} onClick={() => sendCommand('reconnect_wifi')} className="cmd-btn bg-yellow-500 text-white hover:bg-yellow-600">
                    Reconnect WiFi
                  </button>
                  <button disabled={isSendingCommand} onClick={() => { if (confirm('Reboot this device?')) sendCommand('reboot'); }} className="cmd-btn bg-orange-600 text-white hover:bg-orange-700">
                    Reboot
                  </button>
                  <button disabled={isSendingCommand} onClick={() => { if (confirm('Clear ALL settings on this device (WiFi, URL, Device ID)?')) sendCommand('clear_settings'); }} className="cmd-btn bg-red-700 text-white hover:bg-red-800">
                    Clear Settings
                  </button>
                </Section>
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* ── Register Device Modal (super admin) ─────────────────────────────── */}
      <Modal show={showRegisterModal} onClose={() => setShowRegisterModal(false)} size="md">
        <Modal.Header>Register New Device</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label value="Device ID *" />
              <TextInput placeholder="e.g. DEV001" value={registerForm.device_id} onChange={e => setRegisterForm(p => ({ ...p, device_id: e.target.value }))} />
              <p className="text-xs text-gray-500 mt-1">Must match the ID set on the physical device via its local dashboard</p>
            </div>
            <div>
              <Label value="Client *" />
              <select value={registerForm.client_id} onChange={e => setRegisterForm(p => ({ ...p, client_id: e.target.value }))} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label value="Device Name *" />
              <TextInput placeholder="e.g. Main Entrance Reader" value={registerForm.name} onChange={e => setRegisterForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label value="Location" />
              <TextInput placeholder="e.g. Ground Floor Lobby" value={registerForm.location} onChange={e => setRegisterForm(p => ({ ...p, location: e.target.value }))} />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={handleRegister} disabled={isRegistering} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {isRegistering ? 'Registering...' : 'Register'}
          </button>
          <button onClick={() => setShowRegisterModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">Cancel</button>
        </Modal.Footer>
      </Modal>

      {/* ── Edit Device Modal ────────────────────────────────────────────────── */}
      <Modal show={showEditModal} onClose={() => setShowEditModal(false)} size="sm">
        <Modal.Header>Edit Device</Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <div>
              <Label value="Device Name" />
              <TextInput value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label value="Location" />
              <TextInput value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button onClick={handleEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save</button>
          <button onClick={() => setShowEditModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">Cancel</button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

// ─── Small section wrapper ────────────────────────────────────────────────────
const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="border border-gray-200 rounded-lg p-3">
    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-3">
      {icon} {title}
    </div>
    {children}
  </div>
);

export default DeviceManagement;
