export interface MeetupHost {
  id: string;
  name: string;
  email: string;
  city: string;
  bio?: string;
  photoUrl?: string;
}

// Single honest contact until real named hosts (photo, bio, LinkedIn) are
// onboarded — never ship placeholder identities like "Vaughan Host".
export const meetupHosts: MeetupHost[] = [
  {
    id: "host-default",
    name: "Realist Events Team",
    email: "events@realist.ca",
    city: "default",
    bio: "The Realist.ca events team — we organize investor meetups across Canada and can connect you with the local organizer.",
  },
];

export function getHostByCity(city: string): MeetupHost {
  const normalizedCity = city.toLowerCase().trim();
  const host = meetupHosts.find(h =>
    h.city.toLowerCase() === normalizedCity
  );
  return host || meetupHosts.find(h => h.city === "default")!;
}

export function getHostByEventName(eventName: string): MeetupHost {
  const nameLower = eventName.toLowerCase();
  for (const host of meetupHosts) {
    if (host.city !== "default" && nameLower.includes(host.city.toLowerCase())) {
      return host;
    }
  }
  return meetupHosts.find(h => h.city === "default")!;
}
