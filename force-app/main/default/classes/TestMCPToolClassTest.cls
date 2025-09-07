@isTest
public class TestMCPToolClassTest {

	@isTest
	private static void test1() {
		System.runAs(TestDataFactory.createTestUser()) {
			//Set up prerequisites for the logic under test
			TestDataFactory.createAccount('ACME Test');

			Test.startTest();
			//Invoke the logic under test
			Test.stopTest();

			//Verify expected outcome
			System.assertEquals(expectedValue, actualValue, 'Explanation of the assertion failure');
		}
	}
}