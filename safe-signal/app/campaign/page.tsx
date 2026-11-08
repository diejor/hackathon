import CampaignClient from './CampaignClient';

// Read the send switches at request time (not build time) so the page tells the truth about this server.
export const dynamic = 'force-dynamic';

export default function CampaignPage() {
  const drillsOn =
    process.env.ENABLE_PHOTON_TEXT === 'true' &&
    process.env.SAFESIGNAL_SENDING_ENABLED === 'true' &&
    !!process.env.PHOTON_INBOUND_NUMBER;
  return <CampaignClient drillsOn={drillsOn} />;
}
