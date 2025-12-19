'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faVideo,
    faImage,
    faMusic,
    faLightbulb,
    faFilm,
    faBolt,
    faLayerGroup,
    faLock,
    faShieldHalved,
    faCircleCheck,
    faDownload,
    faGlobe,
    faClock,
    faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';
import {
    faFacebook,
    faInstagram,
    faXTwitter,
    faTiktok,
    faWeibo,
} from '@fortawesome/free-brands-svg-icons';

// Platform icons
export const FacebookIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faFacebook} className={className} />
);

export const InstagramIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faInstagram} className={className} />
);

export const XTwitterIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faXTwitter} className={className} />
);

export const TiktokIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faTiktok} className={className} />
);

export const WeiboIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faWeibo} className={className} />
);

// Media type icons
export const VideoIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faVideo} className={className} />
);

export const ImageIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faImage} className={className} />
);

export const MusicIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faMusic} className={className} />
);

export const FilmIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faFilm} className={className} />
);

// Feature icons
export const LightbulbIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faLightbulb} className={className} />
);

export const BoltIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faBolt} className={className} />
);

export const LayersIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faLayerGroup} className={className} />
);

export const LockIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faLock} className={className} />
);

export const ShieldIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faShieldHalved} className={className} />
);

export const CheckCircleIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faCircleCheck} className={className} />
);

export const DownloadIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faDownload} className={className} />
);

export const GlobeIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faGlobe} className={className} />
);

export const ClockIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faClock} className={className} />
);

export const MagicIcon = ({ className }: { className?: string }) => (
    <FontAwesomeIcon icon={faWandMagicSparkles} className={className} />
);

// Platform icon by ID
export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
    switch (platform) {
        case 'facebook': return <FacebookIcon className={className} />;
        case 'instagram': return <InstagramIcon className={className} />;
        case 'twitter': return <XTwitterIcon className={className} />;
        case 'tiktok': return <TiktokIcon className={className} />;
        case 'weibo': return <WeiboIcon className={className} />;
        default: return <GlobeIcon className={className} />;
    }
}
