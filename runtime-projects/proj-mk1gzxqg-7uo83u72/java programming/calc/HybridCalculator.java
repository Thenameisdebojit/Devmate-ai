package calc;

public class HybridCalculator {
    Calculator calc = new Calculator();
    ScientificCalculator sciCalc = new ScientificCalculator();

    public void showOperations() {
        System.out.println("Basic Calculator:");
        System.out.println("Addition: " + calc.add(10, 5));
        System.out.println("Subtraction: " + calc.subtract(10, 5));
        System.out.println("Multiplication: " + calc.multiply(10, 5));
        System.out.println("Division: " + calc.divide(10, 5));

        System.out.println("\nScientific Calculator:");
        System.out.println("Square: " + sciCalc.square(5));
        System.out.println("Square Root: " + sciCalc.squareRoot(25));
        System.out.println("Power: " + sciCalc.power(2, 3));
        System.out.println("Log: " + sciCalc.log(10));
    }

    public static void main(String[] args) {
        HybridCalculator hybrid = new HybridCalculator();
        hybrid.showOperations();
    }
}
