import { prisma } from "..";

const ip_without_gateway = (cidr: string, gateway: string) => {
	const [base, prefixLength] = cidr.split("/");
	const octets = base.split(".").map(Number);

	const totalHosts = 2 ** (32 - Number(prefixLength));

	const usableIPs = [];
	for (let i = 0; i < totalHosts - 1; i++) {
		const currentIP = octets.slice();
		currentIP[3] += i;
		const ipString = currentIP.join(".");
		if (ipString !== gateway) {
			if (
				ipString.split(".")[3] !== "0" &&
				ipString.split(".")[3] !== String(totalHosts - 1)
			)
				// Exclude network and broadcast addresses
				usableIPs.push(ipString);
		}
	}

	return usableIPs.filter((ip) => ip !== gateway);
};

const seed_pve = async () => {
	const pve_nodes = await prisma.pVENode.createMany({
		data: [
			{
				name: "pve-1",
				ipAddress: "10.20.30.201",
			},
			{
				name: "pve-2",
				ipAddress: "10.20.30.202",
			},
			{
				name: "pve-3",
				ipAddress: "10.20.30.203",
			},
			{
				name: "pve-4",
				ipAddress: "10.20.30.204",
			},
			{
				name: "pve-5",
				ipAddress: "10.20.30.205",
			},
			{
				name: "pve-6",
				ipAddress: "10.20.30.206",
			},
			{
				name: "pve-7",
				ipAddress: "10.20.30.207",
			},
			{
				name: "pve-8",
				ipAddress: "10.20.30.208",
			},
			{
				name: "pve-9",
				ipAddress: "10.20.30.209",
			},
			{
				name: "pve-10",
				ipAddress: "10.20.30.210",
			},
		],
		skipDuplicates: true,
	});
	console.log(`Seeded ${pve_nodes.count} pve nodes`);

	const pve_networks = await prisma.pVENetwork.createMany({
		data: [
			{
				name: "831",
				subnet: "10.20.31.0/24",
				gateway: "10.20.31.1",
				bridge: "vmbr1",
				vlanTag: 831,
			},
			{
				name: "832",
				subnet: "10.20.32.0/24",
				gateway: "10.20.32.1",
				bridge: "vmbr1",
				vlanTag: 832,
			},
			{
				name: "833",
				subnet: "10.20.33.0/24",
				gateway: "10.20.33.1",
				bridge: "vmbr1",
				vlanTag: 833,
			},
		],
		skipDuplicates: true,
	});
	console.log(`Seeded ${pve_networks.count} pve networks`);

	for (const network of await prisma.pVENetwork.findMany()) {
		const usable_ips = ip_without_gateway(network.subnet, network.gateway);

		const existing_ips = await prisma.pVENetworkIP.findMany({
			where: { pveNetworkId: network.id },
			select: { ipAddress: true },
		});
		const existing_ip_set = new Set(existing_ips.map((ip) => ip.ipAddress));

		const new_ips = usable_ips
			.filter((ip) => !existing_ip_set.has(ip))
			.map((ip) => ({
				ipAddress: ip,
				pveNetworkId: network.id,
			}));

		const created_ips = await prisma.pVENetworkIP.createMany({
			data: new_ips,
			skipDuplicates: true,
		});
		console.log(`Seeded ${created_ips.count} IPs for network ${network.name}`);
	}

	const pve_templates = await prisma.pVETemplate.createMany({
		data: [
			{ name: "Debian 13", vmId: 101, type: "QEMU", pveNodeId: 1 },
			{ name: "Ubuntu 24.04", vmId: 102, type: "QEMU", pveNodeId: 1 },
			{ name: "Fedora 43", vmId: 103, type: "QEMU", pveNodeId: 1 },
		],
		skipDuplicates: true,
	});
	console.log(`Seeded ${pve_templates.count} pve templates`);
};

seed_pve()
	.then(() => {
		console.log("Seeding completed.");
		process.exit(0);
	})
	.catch((error) => {
		console.error("Error during seeding:", error);
		process.exit(1);
	});
