#include<stdio.h>
#include<stdlib.h>
struct Node{
    int info;
    struct Node* link;
};
void enqueue(struct Node** front, struct Node** rear){
    struct Node* new;
    int item;
    new=(struct Node*)malloc(sizeof(struct Node));
    if(new==NULL){
        printf("OVERFLOW");
    }
    else{
       printf("enter item to be inserted");
       scanf("%d",&item);
       new->info = item;
       new->link = NULL;
       if(*front==NULL && *rear==NULL){
        *front=*rear=new;
       }
       else{
        (*rear)->link=new;
        *rear=new;
       }
    }
}
void dequeue(struct Node** front,struct Node**rear){
    struct Node*ptr;
    if(*front==NULL && *rear==NULL){
        printf("UNDERFLOW");
    }
    else{
        ptr=*front; 
        if(*front==*rear){
            *front=*rear=NULL;
        }
        else{
            *front=(*front)->link;
            free(ptr);
        }
    }
    
}
void traverse(struct Node* front){
    struct Node* ptr=front;
    printf("elements in the queue are:");
    while(ptr!=NULL){
        printf("%d\t",ptr->info);
        ptr=ptr->link;
    }
    printf("\n");  
}
int main(){
    struct Node* front=NULL,*rear=NULL;
    int item,option;
    do{
        printf("\nMENU\n1->enqueue\n2->dequeue\n3->traverse\n4->exit\nenter your choice");
        scanf("%d",&option);
        switch(option){
            case 1: enqueue(&front,&rear);
                   traverse(front);
                   break;
            case 2: dequeue(&front,&rear);
                   traverse(front);
                   break;
            case 3: traverse(front);
                   break;
            case 4: exit(0);
            default:printf("invalid option");

        }
    } while(option<5);

}