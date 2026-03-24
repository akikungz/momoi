import { beforeEach, describe, expect, it } from "bun:test";

import {
	createMockAccount,
	createMockCourse,
	createMockCourseOffering,
	createMockInstance,
	createMockPlatformUser,
	createMockPVENode,
	createMockPVETemplate,
	createMockPVEVM,
	createMockRequest,
	createMockScenario,
	createMockSemester,
	createMockSession,
	createMockUser,
	resetMockFactoryCounters,
} from "@test/mocks";

describe("Mock Factory", () => {
	beforeEach(() => {
		resetMockFactoryCounters();
	});

	describe("createMockUser", () => {
		it("should create a user with default values", () => {
			const user = createMockUser();

			expect(user.id).toMatch(/^user-\d+$/);
			expect(user.name).toBe("Test User");
			expect(user.email).toContain("@example.com");
			expect(user.emailVerified).toBe(true);
			expect(user.image).toBeNull();
		});

		it("should accept overrides", () => {
			const user = createMockUser({
				name: "Custom User",
				email: "custom@test.com",
			});

			expect(user.name).toBe("Custom User");
			expect(user.email).toBe("custom@test.com");
		});

		it("should increment user IDs", () => {
			const user1 = createMockUser();
			const user2 = createMockUser();

			expect(user1.id).toBe("user-1");
			expect(user2.id).toBe("user-2");
		});
	});

	describe("createMockSession", () => {
		it("should create a session with default values", () => {
			const session = createMockSession();

			expect(session.id).toMatch(/^session-/);
			expect(session.token).toMatch(/^token-/);
			expect(session.ipAddress).toBe("127.0.0.1");
			expect(session.userAgent).toBe("Mozilla/5.0");
			expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
		});

		it("should accept user ID override", () => {
			const session = createMockSession({ userId: "custom-user-id" });

			expect(session.userId).toBe("custom-user-id");
		});

		it("should accept other overrides", () => {
			const customExpiry = new Date(Date.now() + 1000000);
			const session = createMockSession({
				ipAddress: "192.168.1.1",
				userAgent: "Custom Agent",
				expiresAt: customExpiry,
			});

			expect(session.ipAddress).toBe("192.168.1.1");
			expect(session.userAgent).toBe("Custom Agent");
			expect(session.expiresAt).toBe(customExpiry);
		});
	});

	describe("createMockAccount", () => {
		it("should create an account with default values", () => {
			const account = createMockAccount();

			expect(account.id).toMatch(/^account-/);
			expect(account.accountId).toMatch(/^google-/);
			expect(account.providerId).toBe("google");
			expect(account.scope).toBe("email profile");
			expect(account.accessToken).toBeNull();
			expect(account.refreshToken).toBeNull();
		});

		it("should accept user ID override", () => {
			const account = createMockAccount({ userId: "test-user-id" });

			expect(account.userId).toBe("test-user-id");
		});

		it("should accept other overrides", () => {
			const account = createMockAccount({
				providerId: "github",
				scope: "user:email",
				accessToken: "test-token",
			});

			expect(account.providerId).toBe("github");
			expect(account.scope).toBe("user:email");
			expect(account.accessToken).toBe("test-token");
		});
	});

	describe("createMockPlatformUser", () => {
		it("should create a platform user with default values", () => {
			const platformUser = createMockPlatformUser();

			expect(platformUser.id).toBe(1);
			expect(platformUser.role).toBe("STUDENT");
			expect(platformUser.userId).toMatch(/^user-/);
		});

		it("should increment platform user IDs", () => {
			const user1 = createMockPlatformUser();
			const user2 = createMockPlatformUser();

			expect(user1.id).toBe(1);
			expect(user2.id).toBe(2);
		});

		it("should accept overrides", () => {
			const platformUser = createMockPlatformUser({
				role: "INSTRUCTOR",
				userId: "custom-user-id",
			});

			expect(platformUser.role).toBe("INSTRUCTOR");
			expect(platformUser.userId).toBe("custom-user-id");
		});
	});

	describe("createMockCourse", () => {
		it("should create a course with default values", () => {
			const course = createMockCourse();

			expect(course.id).toBe(1);
			expect(course.code).toMatch(/^CS\d+$/);
			expect(course.title).toContain("Test Course");
			expect(course.description).toContain("Description for course");
		});

		it("should increment course IDs and update code", () => {
			const course1 = createMockCourse();
			const course2 = createMockCourse();

			expect(course1.id).toBe(1);
			expect(course1.code).toBe("CS1001");
			expect(course2.id).toBe(2);
			expect(course2.code).toBe("CS1002");
		});

		it("should accept overrides", () => {
			const course = createMockCourse({
				code: "CS101",
				title: "Custom Course",
				description: "Custom description",
			});

			expect(course.code).toBe("CS101");
			expect(course.title).toBe("Custom Course");
			expect(course.description).toBe("Custom description");
		});
	});

	describe("createMockSemester", () => {
		it("should create a semester with default values", () => {
			const semester = createMockSemester();

			expect(semester.id).toBe(1);
			expect(semester.name).toMatch(/^(Spring|Summer|Fall) \d{4}$/);
			expect(semester.startDate).toBeInstanceOf(Date);
			expect(semester.endDate).toBeInstanceOf(Date);
		});

		it("should cycle through terms", () => {
			resetMockFactoryCounters();
			const spring = createMockSemester();
			const summer = createMockSemester();
			const fall = createMockSemester();
			const nextSpring = createMockSemester();

			expect(spring.name).toContain("Spring");
			expect(summer.name).toContain("Summer");
			expect(fall.name).toContain("Fall");
			expect(nextSpring.name).toContain("Spring");
		});

		it("should accept overrides", () => {
			const semester = createMockSemester({
				name: "Winter 2025",
				isCurrent: true,
			});

			expect(semester.name).toBe("Winter 2025");
			expect(semester.isCurrent).toBe(true);
		});
	});

	describe("createMockCourseOffering", () => {
		it("should create a course offering with default values", () => {
			const offering = createMockCourseOffering();

			expect(offering.courseId).toBe(1);
			expect(offering.semesterId).toBe(1);
		});

		it("should accept overrides", () => {
			const offering = createMockCourseOffering({
				courseId: 5,
				semesterId: 3,
			});

			expect(offering.courseId).toBe(5);
			expect(offering.semesterId).toBe(3);
		});
	});

	describe("createMockPVENode", () => {
		it("should create a PVE node with default values", () => {
			const node = createMockPVENode();

			expect(node.id).toBe(1);
			expect(node.name).toBe("pve-node-1");
			expect(node.ipAddress).toMatch(/^192\.168\.1\.\d+$/);
		});

		it("should increment node IDs", () => {
			const node1 = createMockPVENode();
			const node2 = createMockPVENode();

			expect(node1.id).toBe(1);
			expect(node2.id).toBe(2);
			expect(node1.ipAddress).toBe("192.168.1.11");
			expect(node2.ipAddress).toBe("192.168.1.12");
		});

		it("should accept overrides", () => {
			const node = createMockPVENode({
				name: "custom-node",
				ipAddress: "10.0.0.1",
			});

			expect(node.name).toBe("custom-node");
			expect(node.ipAddress).toBe("10.0.0.1");
		});
	});

	describe("createMockPVETemplate", () => {
		it("should create a PVE template with default values", () => {
			const template = createMockPVETemplate();

			expect(template.id).toBe(1);
			expect(template.name).toContain("Ubuntu 22.04 Template");
			expect(template.description).toContain("Template");
			expect(template.vmId).toBe(9001);
			expect(template.type).toBe("QEMU");
		});

		it("should increment template IDs and vmIds", () => {
			const template1 = createMockPVETemplate();
			const template2 = createMockPVETemplate();

			expect(template1.id).toBe(1);
			expect(template1.vmId).toBe(9001);
			expect(template2.id).toBe(2);
			expect(template2.vmId).toBe(9002);
		});

		it("should accept overrides", () => {
			const template = createMockPVETemplate({
				name: "Debian Template",
				type: "LXC",
			});

			expect(template.name).toBe("Debian Template");
			expect(template.type).toBe("LXC");
		});
	});

	describe("createMockPVEVM", () => {
		it("should create a PVE VM with default values", () => {
			const vm = createMockPVEVM();

			expect(vm.id).toBe(1000);
			expect(vm.vmId).toBe(1000);
			expect(vm.hostname).toContain(".local");
			expect(vm.status).toBe("RUNNING");
			expect(vm.type).toBe("QEMU");
			expect(vm.pveNodeId).toBe(1);
		});

		it("should increment VM IDs", () => {
			const vm1 = createMockPVEVM();
			const vm2 = createMockPVEVM();

			expect(vm1.id).toBe(1000);
			expect(vm2.id).toBe(1001);
		});

		it("should accept overrides", () => {
			const vm = createMockPVEVM({
				hostname: "custom-vm.example.com",
				status: "STOPPED",
				pveNodeId: 5,
			});

			expect(vm.hostname).toBe("custom-vm.example.com");
			expect(vm.status).toBe("STOPPED");
			expect(vm.pveNodeId).toBe(5);
		});
	});

	describe("createMockRequest", () => {
		it("should create a request with default values", () => {
			const request = createMockRequest();

			expect(request.id).toBe(1);
			expect(request.title).toContain("Test Request");
			expect(request.description).toContain("Description for request");
			expect(request.courseOfferingId).toBe(1);
			expect(request.pveTemplateId).toBe(1);
			expect(request.cpus).toBe(2);
			expect(request.memoryMB).toBe(4096);
			expect(request.diskGB).toBe(50);
			expect(request.status).toBe("PENDING");
			expect(request.reviewerId).toBeNull();
			expect(request.reason).toBeNull();
		});

		it("should increment request IDs", () => {
			const request1 = createMockRequest();
			const request2 = createMockRequest();

			expect(request1.id).toBe(1);
			expect(request2.id).toBe(2);
		});

		it("should accept overrides", () => {
			const request = createMockRequest({
				title: "Custom Request",
				status: "APPROVED",
				reviewerId: 5,
			});

			expect(request.title).toBe("Custom Request");
			expect(request.status).toBe("APPROVED");
			expect(request.reviewerId).toBe(5);
		});
	});

	describe("createMockInstance", () => {
		it("should create an instance with default values", () => {
			const instance = createMockInstance();

			expect(instance.id).toBe(1);
			expect(instance.platformUserId).toBe(1);
			expect(instance.pveVMId).toBeNull();
			expect(instance.pveTemplateId).toBe(1);
			expect(instance.cpus).toBe(2);
			expect(instance.memoryMB).toBe(4096);
			expect(instance.diskGB).toBe(50);
			expect(instance.status).toBe("PENDING");
			expect(instance.provisionStatus).toBe("NOT_STARTED");
			expect(instance.provisionError).toBeNull();
		});

		it("should increment instance IDs", () => {
			const instance1 = createMockInstance();
			const instance2 = createMockInstance();

			expect(instance1.id).toBe(1);
			expect(instance2.id).toBe(2);
		});

		it("should accept overrides", () => {
			const instance = createMockInstance({
				platformUserId: 5,
				status: "ACTIVE",
				pveVMId: 1001,
			});

			expect(instance.platformUserId).toBe(5);
			expect(instance.status).toBe("ACTIVE");
			expect(instance.pveVMId).toBe(1001);
		});
	});

	describe("createMockScenario", () => {
		it("should create a complete scenario with related entities", () => {
			const scenario = createMockScenario();

			expect(scenario.user).toBeDefined();
			expect(scenario.platformUser).toBeDefined();
			expect(scenario.course).toBeDefined();
			expect(scenario.semester).toBeDefined();
			expect(scenario.courseOffering).toBeDefined();
			expect(scenario.template).toBeDefined();
			expect(scenario.node).toBeDefined();
			expect(scenario.vm).toBeDefined();
			expect(scenario.request).toBeDefined();
			expect(scenario.instance).toBeDefined();
		});

		it("should have properly related entities", () => {
			const scenario = createMockScenario();

			expect(scenario.platformUser.userId).toBe(scenario.user.id);
			expect(scenario.courseOffering.courseId).toBe(scenario.course.id);
			expect(scenario.courseOffering.semesterId).toBe(scenario.semester.id);
			expect(scenario.instance.platformUserId).toBe(scenario.platformUser.id);
			expect(scenario.instance.pveTemplateId).toBe(scenario.template.id);
			expect(scenario.instance.pveVMId).toBe(scenario.vm.id);
			expect(scenario.request.courseOfferingId).toBe(
				scenario.courseOffering.id,
			);
		});

		it("should create unique scenarios on multiple calls", () => {
			resetMockFactoryCounters();
			const scenario1 = createMockScenario();
			const scenario2 = createMockScenario();

			expect(scenario1.user.id).not.toBe(scenario2.user.id);
			expect(scenario1.course.id).not.toBe(scenario2.course.id);
			expect(scenario1.instance.id).not.toBe(scenario2.instance.id);
		});
	});

	describe("resetMockFactoryCounters", () => {
		it("should reset all counters to initial values", () => {
			// Create some entities to increment counters
			createMockUser();
			createMockUser();
			createMockCourse();
			createMockInstance();

			// Reset counters
			resetMockFactoryCounters();

			// Create new entities - should start from 1 again
			const user = createMockUser();
			const course = createMockCourse();
			const instance = createMockInstance();

			expect(user.id).toBe("user-1");
			expect(course.id).toBe(1);
			expect(instance.id).toBe(1);
		});
	});
});
