export interface MeetupHost {
  id: string;
  name: string;
  email: string;
  city: string;
  bio?: string;
  photoUrl?: string;
}

export const meetupHosts: MeetupHost[] = [
  {
    id: "host-vaughan",
    name: "Vaughan Host",
    email: "vaughan@realist.ca",
    city: "Vaughan",
    bio: "Local real estate investor and community organizer.",
  },
  {
    id: "host-toronto",
    name: "Toronto Host", 
    email: "toronto@realist.ca",
    city: "Toronto",
    bio: "Passionate about connecting investors in the GTA.",
  },
  {
    id: "host-default",
    name: "Realist Team",
    email: "events@realist.ca",
    city: "default",
    bio: "The Realist.ca events team.",
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
