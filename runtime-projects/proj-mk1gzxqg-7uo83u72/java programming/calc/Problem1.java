public class Problem1{
    public static void main (String []args){

        // try {
        //     int number=10/0;
        //     System.out.println(number);
        // } catch (ArithmeticException e) {
        //     System.out.println("ArithmeticException: " + e.getMessage());
        // }
        // System.out.println("End of the program code running...");
        // try {
        //     int [] arr = {1,2,3,4,5};
        //     System.out.println(arr[10]);
        // } catch (ArrayIndexOutOfBoundsException e) {
        //     System.out.println("ArrayIndexOutOfBoundsException: " + e.getMessage());
        // }
        // System.out.println("End of the program code running...");
        try {
            String str = null;
            System.out.println(str.length());

        } catch (NullPointerException e) {
            System.out.println("NullPointerException: " + e.getMessage());
        }
    }


}