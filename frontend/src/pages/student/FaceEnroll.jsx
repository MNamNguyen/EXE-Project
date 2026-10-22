import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CameraOff, RotateCw, ScanFace, ShieldCheck, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { faceApi } from '../../services/api';
import Layout from '../../components/layout/Layout';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { useConfirm } from '../../components/ui/Modal';
import { Banner, LoadError, Skeleton } from '../../components/ui/States';
import useFaceCamera from '../face/useFaceCamera';
import { cropThumbnail, detectFaces, faceProblem, loadFaceEngine } from '../face/faceEngine';
import { averageEmbeddings, encodeEmbedding } from '../face/faceMatch';

// Sinh viên tự đăng ký / đổi / xoá khuôn mặt dùng cho kiosk check-in. Embedding tính ngay
// trong trình duyệt (trung bình vài khung hình); server chỉ nhận vector + thumbnail nhỏ.

const SAMPLES = 3;
const SAMPLE_GAP_MS = 350;

const CONSENT_TEXT = 'Tôi đồng ý cho hệ thống lưu đặc trưng khuôn mặt (một dãy số, không lưu ảnh gốc) '
  + 'và một ảnh thu nhỏ của tôi để check-in tại cửa các sự kiện. Tôi có thể xoá dữ liệu này bất cứ lúc nào.';

const STATUS_BADGE = {
  active: { tone: 'success', label: 'Đang bật' },
  'pending-consent': { tone: 'warning', label: 'Chờ bạn đồng ý' },
  none: { tone: 'neutral', label: 'Chưa đăng ký' },
};

export default function FaceEnroll() {
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [consent, setConsent] = useState(false);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const { data } = await faceApi.getMine();
      setProfile(data.data);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const acceptImport = async () => {
    try {
      const { data } = await faceApi.consentMine();
      toast.success(data.message);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không lưu được');
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Xoá dữ liệu khuôn mặt?',
      body: 'Kiosk sẽ không nhận ra bạn nữa. Ảnh nhà trường cung cấp (nếu có) cũng bị xoá.',
      confirmLabel: 'Xoá',
    });
    if (!ok) return;
    try {
      const { data } = await faceApi.deleteMine();
      toast.success(data.message);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không xoá được');
    }
  };

  let content;
  if (loadError) content = <LoadError title="Không tải được dữ liệu khuôn mặt" onRetry={load} />;
  else if (!profile) content = <Card><Skeleton className="h-24 w-full" /></Card>;
  else if (capturing) {
    content = (
      <Capture
        onCancel={() => setCapturing(false)}
        onSaved={(p) => { setCapturing(false); setProfile(p); }}
      />
    );
  } else {
    const badge = STATUS_BADGE[profile.status];
    content = (
      <div className="flex flex-col gap-4">
        <Card title="Check-in bằng khuôn mặt" sub="Ở sự kiện có kiosk, bạn chỉ cần đi qua camera ở cửa — không phải quét QR.">
          <div className="flex items-center gap-4">
            {profile.thumbnail ? (
              <img src={`data:image/jpeg;base64,${profile.thumbnail}`} alt="Ảnh khuôn mặt đã lưu" className="size-20 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-background text-muted">
                <ScanFace className="size-8" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0">
              <Badge tone={badge.tone}>{badge.label}</Badge>
              {profile.status !== 'none' && (
                <p className="mt-2 text-sm text-muted">
                  {profile.source === 'IMPORT' ? 'Ảnh do nhà trường cung cấp' : 'Ảnh bạn tự chụp'}
                  {profile.updatedAt && ` · ${format(new Date(profile.updatedAt), 'dd/MM/yyyy')}`}
                </p>
              )}
            </div>
          </div>

          {profile.status === 'pending-consent' && (
            <Banner tone="warning" className="mt-4" title="Nhà trường đã cung cấp ảnh của bạn">
              Ảnh chỉ được dùng ở kiosk sau khi bạn đồng ý. Bạn cũng có thể tự chụp ảnh mới (phải cùng là bạn) hoặc xoá ảnh.
            </Banner>
          )}

          {profile.status !== 'active' && (
            <label className="mt-4 flex items-start gap-3 text-sm text-foreground">
              <input type="checkbox" className="mt-0.5 size-4 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="text-pretty">{CONSENT_TEXT}</span>
            </label>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {profile.status === 'pending-consent' && (
              <Button variant="primary" size="form" icon={ShieldCheck} disabled={!consent} onClick={acceptImport}>Đồng ý dùng ảnh này</Button>
            )}
            <Button
              variant={profile.status === 'none' ? 'primary' : 'outline'}
              size="form"
              icon={Camera}
              disabled={profile.status !== 'active' && !consent}
              onClick={() => setCapturing(true)}
            >
              {profile.status === 'none' ? 'Chụp khuôn mặt' : 'Chụp lại'}
            </Button>
            {profile.status !== 'none' && (
              <Button variant="danger" size="form" icon={Trash2} onClick={remove}>Xoá dữ liệu khuôn mặt</Button>
            )}
          </div>
        </Card>
        <p className="text-pretty text-xs text-muted">
          Chúng tôi không lưu ảnh gốc. Đặc trưng khuôn mặt chỉ dùng để Ban tổ chức check-in cho bạn tại cửa sự kiện bạn đã đăng ký.
        </p>
      </div>
    );
  }

  return (
    <Layout title="Khuôn mặt">
      <div className="max-w-2xl">{content}</div>
    </Layout>
  );
}

function Capture({ onCancel, onSaved }) {
  const [engine, setEngine] = useState('loading');
  const [hint, setHint] = useState('Nhìn thẳng vào camera');
  const [result, setResult] = useState(null); // { embedding, thumbnail }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const samplesRef = useRef([]);
  const thumbRef = useRef(null);
  const lastSampleRef = useRef(0);

  useEffect(() => {
    loadFaceEngine().then(() => setEngine('ready')).catch(() => setEngine('error'));
  }, []);

  const onFrame = useCallback(async (video) => {
    if (samplesRef.current.length >= SAMPLES) return;
    const faces = await detectFaces(video);
    if (faces.length > 1) { setHint('Chỉ một người trong khung hình'); return; }
    const problem = faceProblem(faces[0]);
    if (problem) { setHint(problem); return; }
    if (Date.now() - lastSampleRef.current < SAMPLE_GAP_MS) return;
    lastSampleRef.current = Date.now();
    samplesRef.current.push(faces[0].embedding);
    if (!thumbRef.current) thumbRef.current = cropThumbnail(video, faces[0]);
    setHint(`Giữ yên… ${samplesRef.current.length}/${SAMPLES}`);
    if (samplesRef.current.length >= SAMPLES) {
      setResult({ embedding: averageEmbeddings(samplesRef.current), thumbnail: thumbRef.current });
    }
  }, []);

  const camera = useFaceCamera({ onFrame, paused: engine !== 'ready' || Boolean(result) });
  const { start, stop, status } = camera;

  useEffect(() => {
    if (engine === 'ready') start();
  }, [engine, start]);
  useEffect(() => { if (result) stop(); }, [result, stop]);

  const retake = () => {
    samplesRef.current = [];
    thumbRef.current = null;
    setError(null);
    setResult(null);
    setHint('Nhìn thẳng vào camera');
    start();
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await faceApi.saveMine({ embedding: encodeEmbedding(result.embedding), thumbnail: result.thumbnail });
      toast.success(data.message);
      onSaved(data.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không lưu được, thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Chụp khuôn mặt" sub="Đứng nơi đủ sáng, bỏ khẩu trang/kính râm, nhìn thẳng vào camera.">
      <div className="relative overflow-hidden rounded-2xl bg-black">
        {result ? (
          <img src={`data:image/jpeg;base64,${result.thumbnail}`} alt="Ảnh vừa chụp" className="mx-auto aspect-square w-full max-w-xs object-cover" />
        ) : (
          <video ref={camera.videoRef} muted playsInline className="aspect-[4/3] w-full -scale-x-100 object-cover" />
        )}
        {!result && status === 'running' && (
          <p className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-sm text-white">{hint}</p>
        )}
        {!result && status !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            {engine === 'loading' && <><ScanFace className="size-8 animate-pulse" aria-hidden="true" /><p className="text-sm">Đang tải mô hình nhận diện…</p></>}
            {engine === 'error' && <><CameraOff className="size-8" aria-hidden="true" /><p className="text-sm">Không tải được mô hình. Kiểm tra mạng rồi thử lại.</p></>}
            {engine === 'ready' && status === 'starting' && <p className="text-sm">Đang mở camera…</p>}
            {['denied', 'unsupported', 'error'].includes(status) && (
              <>
                <CameraOff className="size-8" aria-hidden="true" />
                <p className="text-pretty text-sm">
                  {status === 'denied'
                    ? 'Trình duyệt chưa được phép dùng camera. Mở cài đặt trang để cho phép, rồi thử lại.'
                    : 'Không mở được camera trên thiết bị này.'}
                </p>
                <Button size="form" icon={RotateCw} onClick={() => { stop(); start(); }}>Thử lại</Button>
              </>
            )}
          </div>
        )}
      </div>

      {error && <Banner tone="error" compact className="mt-4">{error}</Banner>}

      <div className="mt-4 flex flex-wrap gap-2">
        {result && <Button variant="primary" size="form" loading={saving} onClick={save}>Lưu khuôn mặt</Button>}
        {result && <Button size="form" icon={RotateCw} onClick={retake}>Chụp lại</Button>}
        <Button variant="ghost" size="form" onClick={onCancel}>Huỷ</Button>
      </div>
    </Card>
  );
}

// Thẻ nhắc trên trang chủ sinh viên khi nhà trường đã import ảnh mà họ chưa đồng ý.
export function FaceConsentBanner() {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    faceApi.getMine().then(({ data }) => setPending(data.data.status === 'pending-consent')).catch(() => {});
  }, []);
  if (!pending) return null;
  return (
    <Banner
      tone="info"
      className="mb-4"
      title="Bật check-in bằng khuôn mặt?"
      action={<Button as={Link} to="/khuon-mat" size="sm">Xem</Button>}
    >
      Nhà trường đã cung cấp ảnh của bạn. Đồng ý để đi qua kiosk ở cửa là được check-in, không cần quét QR.
    </Banner>
  );
}
