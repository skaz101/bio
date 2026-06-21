const LOOKUP_FIELDS = "success,message,city,region,country_code,timezone,latitude,longitude,connection";

function present(value) {
  return value !== undefined && value !== null && value !== "" && value !== "Unknown";
}

function fromCloudflare(cf = {}) {
  return {
    city: cf.city,
    region: cf.region,
    country: cf.country,
    timezone: cf.timezone,
    latitude: cf.latitude,
    longitude: cf.longitude,
    postalCode: cf.postalCode,
    colo: cf.colo,
    isp: cf.asOrganization,
    asn: cf.asn
  };
}

function fromLookup(data = {}) {
  return {
    city: data.city,
    region: data.region,
    country: data.country_code,
    timezone: data.timezone?.id,
    latitude: data.latitude,
    longitude: data.longitude,
    isp: data.connection?.isp || data.connection?.org,
    asn: data.connection?.asn
  };
}

function merge(...sources) {
  const result = {};
  for (const key of ["city", "region", "country", "timezone", "latitude", "longitude", "postalCode", "colo", "isp", "asn"]) {
    const source = sources.find((item) => present(item?.[key]));
    if (source) result[key] = source[key];
  }
  return result;
}

function complete(metadata) {
  return present(metadata.city) && present(metadata.region) && present(metadata.country) && present(metadata.timezone) && present(metadata.isp);
}

export async function enrichIpMetadata({ ip, cf, existing, kv, cacheKey }) {
  const native = fromCloudflare(cf);
  let metadata = merge(native, existing);
  const validIp = typeof ip === "string" && (ip.includes(".") || ip.includes(":"));
  if (complete(metadata) || !validIp) return metadata;

  const key = `ip-metadata:${cacheKey}`;
  let lookedUp = await kv?.get(key, { type: "json" });
  if (!lookedUp) {
    try {
      const url = new URL(`https://ipwho.is/${encodeURIComponent(ip)}`);
      url.searchParams.set("fields", LOOKUP_FIELDS);
      const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(2500) });
      const data = response.ok ? await response.json() : null;
      lookedUp = data?.success ? fromLookup(data) : {};
    } catch {
      lookedUp = {};
    }
    await kv?.put(key, JSON.stringify(lookedUp), { expirationTtl: 86400 });
  }

  metadata = merge(native, lookedUp, existing);
  return metadata;
}
